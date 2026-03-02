import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { BootstrapPayload, EpisodeView, PostGameReport } from '@wargames/shared-types';

import {
  bootstrapReference,
  createProfile,
  extendCountdown,
  fetchReport,
  startEpisode,
  submitAction,
  submitInaction
} from './api';
import { ActionCards } from './components/ActionCards';
import { BriefingPanel } from './components/BriefingPanel';
import { IntelPanel } from './components/IntelPanel';
import { MeterDashboard } from './components/MeterDashboard';
import { ReportView } from './components/ReportView';
import { StartScreen } from './components/StartScreen';

const formatSeconds = (seconds: number): string => {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  const remainder = whole % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
};

const pickPressureText = (
  reference: BootstrapPayload,
  beatId: string,
  secondsRemaining: number
): string | null => {
  const category = reference.narrativeCandidates.categories.find((entry) => entry.category === 'pressure_text');
  if (!category || category.category !== 'pressure_text') {
    return null;
  }

  const choose = (entries: typeof category.entries): string | null => {
    const ordered = [...entries].sort((left, right) => left.thresholdSeconds - right.thresholdSeconds);
    const selected = ordered.find((entry) => secondsRemaining <= entry.thresholdSeconds);
    return selected?.text ?? null;
  };

  const beatSpecific = category.entries.filter((entry) => entry.beatId === beatId);
  const generic = category.entries.filter((entry) => entry.beatId === '_generic');
  return choose(beatSpecific) ?? choose(generic);
};

const App = () => {
  const [reference, setReference] = useState<BootstrapPayload | null>(null);
  const [episode, setEpisode] = useState<EpisodeView | null>(null);
  const [report, setReport] = useState<PostGameReport | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [codename, setCodename] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdownRemaining, setCountdownRemaining] = useState<number | null>(null);
  const timeoutGuardRef = useRef<string | null>(null);

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        setBootstrapping(true);
        const payload = await bootstrapReference();
        setReference(payload);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load reference data');
      } finally {
        setBootstrapping(false);
      }
    };

    void load();
  }, []);

  const currentArchetypeName = useMemo(() => {
    if (!reference || !episode) {
      return '';
    }
    return reference.archetypes.find((entry) => entry.id === episode.rivalArchetypeId)?.name ?? episode.rivalArchetypeId;
  }, [reference, episode]);

  const currentBeat = useMemo(() => {
    if (!reference || !episode) {
      return null;
    }
    const scenario = reference.scenarios.find((entry) => entry.id === episode.scenarioId);
    return scenario?.beats.find((beat) => beat.id === episode.currentBeatId) ?? null;
  }, [reference, episode?.scenarioId, episode?.currentBeatId]);

  const applyEpisodeUpdate = useCallback(async (nextEpisode: EpisodeView): Promise<void> => {
    setEpisode(nextEpisode);
    if (nextEpisode.status === 'completed') {
      const completedReport = await fetchReport(nextEpisode.episodeId);
      setReport(completedReport);
    }
  }, []);

  const handleStart = async (input: {
    codename: string;
    scenarioId: string;
    archetypeId: string;
    seed?: string;
    timerMode: 'standard' | 'relaxed' | 'off';
  }): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const profile = await createProfile(input.codename.trim());
      setProfileId(profile.profileId);
      setCodename(profile.codename);

      const payload: {
        profileId: string;
        scenarioId: string;
        archetypeId: string;
        seed?: string;
        timerMode: 'standard' | 'relaxed' | 'off';
      } = {
        profileId: profile.profileId,
        scenarioId: input.scenarioId,
        archetypeId: input.archetypeId,
        timerMode: input.timerMode
      };

      if (input.seed) {
        payload.seed = input.seed;
      }

      const started = await startEpisode(payload);

      setReport(null);
      await applyEpisodeUpdate(started);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'Failed to start episode');
    } finally {
      setLoading(false);
    }
  };

  const handleActionSelect = async (actionId: string): Promise<void> => {
    if (!episode) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await submitAction(episode.episodeId, {
        expectedTurn: episode.turn,
        actionId
      });

      await applyEpisodeUpdate(response.episode);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Action submission failed');
    } finally {
      setLoading(false);
    }
  };

  const handleInaction = useCallback(
    async (source: 'timeout' | 'explicit'): Promise<void> => {
      if (!episode) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await submitInaction(episode.episodeId, {
          expectedTurn: episode.turn,
          source
        });
        await applyEpisodeUpdate(response.episode);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : 'Inaction submission failed');
      } finally {
        setLoading(false);
      }
    },
    [applyEpisodeUpdate, episode]
  );

  const handleExtendTimer = useCallback(async (): Promise<void> => {
    if (!episode) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await extendCountdown(episode.episodeId, {
        expectedTurn: episode.turn
      });
      setEpisode(response.episode);
    } catch (extendError) {
      setError(extendError instanceof Error ? extendError.message : 'Timer extension failed');
    } finally {
      setLoading(false);
    }
  }, [episode]);

  useEffect(() => {
    timeoutGuardRef.current = null;
  }, [episode?.episodeId, episode?.turn, episode?.currentBeatId]);

  useEffect(() => {
    if (!episode || episode.status !== 'active' || !episode.activeCountdown) {
      setCountdownRemaining(null);
      return;
    }

    const timeoutKey = `${episode.episodeId}:${episode.turn}:${episode.currentBeatId}`;
    const tick = (): void => {
      const remaining = Math.max(0, Math.ceil((episode.activeCountdown!.expiresAt - Date.now()) / 1000));
      setCountdownRemaining(remaining);

      if (remaining === 0 && timeoutGuardRef.current !== timeoutKey) {
        timeoutGuardRef.current = timeoutKey;
        void handleInaction('timeout');
      }
    };

    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [episode?.episodeId, episode?.turn, episode?.currentBeatId, episode?.status, episode?.activeCountdown?.expiresAt, handleInaction]);

  const reset = (): void => {
    setEpisode(null);
    setReport(null);
    setError(null);
    setCountdownRemaining(null);
    timeoutGuardRef.current = null;
  };

  if (bootstrapping || !reference) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-6">
        <div className="card p-6 text-sm text-textMuted">Loading strategic theater configuration...</div>
      </main>
    );
  }

  if (report) {
    return <ReportView report={report} onRestart={reset} />;
  }

  if (!episode) {
    return <StartScreen reference={reference} loading={loading} error={error} onStart={handleStart} />;
  }

  const remainingSeconds = episode.activeCountdown
    ? countdownRemaining ?? Math.max(0, episode.activeCountdown.secondsRemaining)
    : null;
  const countdownRatio =
    episode.activeCountdown && remainingSeconds !== null && episode.activeCountdown.seconds > 0
      ? remainingSeconds / episode.activeCountdown.seconds
      : null;
  const countdownToneClass =
    countdownRatio === null
      ? 'text-textMuted'
      : countdownRatio <= 0.25
        ? 'text-red-400 animate-pulse'
        : countdownRatio <= 0.5
          ? 'text-warning'
          : 'text-textMain';
  const progressToneClass =
    countdownRatio === null ? 'bg-borderTone' : countdownRatio <= 0.25 ? 'bg-red-500' : countdownRatio <= 0.5 ? 'bg-warning' : 'bg-textMain';
  const canExtendTimer = Boolean(
    episode.activeCountdown &&
      remainingSeconds !== null &&
      remainingSeconds > 0 &&
      episode.timerMode !== 'off' &&
      episode.extendTimerUsesRemaining > 0 &&
      episode.activeCountdown.extendsUsed < 1 &&
      !loading &&
      episode.status === 'active'
  );
  const showTakeNoAction =
    episode.status === 'active' &&
    episode.timerMode === 'off' &&
    Boolean(currentBeat?.decisionWindow);
  const extendPreviewSeconds = episode.activeCountdown ? Math.max(1, Math.round(episode.activeCountdown.seconds * 0.5)) : 0;
  const pressureText = (
    episode.activeCountdown &&
    remainingSeconds !== null &&
    remainingSeconds > 0
  )
    ? pickPressureText(reference, episode.currentBeatId, remainingSeconds)
    : null;

  return (
    <main className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-6 py-5">
      <header className="card flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <div>
          <p className="label">ESCALATION // COMMAND LAYER</p>
          <h1 className="font-display text-2xl text-accent">WARGAMES</h1>
        </div>
        <div className="text-right">
          <p className="text-sm text-textMain">Commander: {codename || profileId?.slice(0, 8) || 'Unknown'}</p>
          <p className="text-xs text-textMuted">Rival Profile: {currentArchetypeName}</p>
          <p className="text-xs text-textMuted">Timer Mode: {episode.timerMode}</p>
        </div>
      </header>

      {error ? (
        <div className="rounded-md border border-warning/70 bg-warning/10 px-3 py-2 text-sm text-warning">{error}</div>
      ) : null}

      <section className="card px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 text-xs text-textMuted">
            <span className="label">Ambient Status</span>
            <span>Beat: {episode.currentBeatId}</span>
            <span>Timer Uses Left: {episode.extendTimerUsesRemaining}</span>
          </div>

          {episode.activeCountdown && remainingSeconds !== null ? (
            <div className="min-w-[280px] space-y-2">
              <div className="flex items-center justify-end gap-3">
                <span className="text-xs text-textMuted">Decision Window</span>
                <span className={`font-mono text-sm ${countdownToneClass}`}>{formatSeconds(remainingSeconds)}</span>
                <button
                  type="button"
                  className="rounded-sm border border-borderTone px-2 py-1 text-[0.7rem] text-textMuted transition hover:border-accent hover:text-textMain disabled:cursor-not-allowed disabled:opacity-45"
                  onClick={() => void handleExtendTimer()}
                  disabled={!canExtendTimer}
                >
                  Extend +{formatSeconds(extendPreviewSeconds)}
                </button>
              </div>
              <div className="h-1.5 overflow-hidden rounded-sm bg-borderTone/70">
                <div
                  className={`h-full transition-[width] duration-200 ${progressToneClass}`}
                  style={{
                    width: `${Math.max(0, Math.min(100, ((remainingSeconds / Math.max(1, episode.activeCountdown.seconds)) * 100)))}%`
                  }}
                />
              </div>
              {pressureText ? (
                <p className="text-right text-[0.72rem] text-textMuted">{pressureText}</p>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-textMuted">
              {showTakeNoAction ? 'Timed beat active: choose an action or trigger Take No Action.' : 'No active countdown in this beat.'}
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <BriefingPanel
          turn={episode.turn}
          maxTurns={episode.maxTurns}
          briefing={episode.briefing}
          imageAsset={episode.imageAsset}
          turnDebrief={episode.turnDebrief}
        />

        <div className="space-y-4">
          <MeterDashboard
            meters={episode.meters}
            previousMeters={episode.recentTurn?.meterBefore}
            visibleRanges={episode.visibleRanges}
          />
          <IntelPanel
            ranges={episode.visibleRanges}
            intelQuality={episode.intelQuality}
            turn={episode.turn}
          />
        </div>
      </section>

      {showTakeNoAction ? (
        <section className="card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm text-textMuted">
            Timer mode is off for this timed beat. Use explicit no-action to enter the authored inaction branch.
          </p>
          <button
            type="button"
            className="rounded-sm border border-warning/70 bg-warning/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-warning transition hover:bg-warning/20 disabled:cursor-not-allowed disabled:opacity-45"
            onClick={() => void handleInaction('explicit')}
            disabled={loading || episode.status !== 'active'}
          >
            Take No Action
          </button>
        </section>
      ) : null}

      <ActionCards
        actions={episode.offeredActions}
        disabled={loading || episode.status !== 'active'}
        onSelect={handleActionSelect}
      />
    </main>
  );
};

export default App;
