import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ActionDefinition, BootstrapPayload, EpisodeView, PostGameReport } from '@wargames/shared-types';

import {
  bootstrapReference,
  createProfile,
  extendCountdown,
  fetchReport,
  interpretCommand as interpretEpisodeCommand,
  startEpisode,
  submitAction,
  submitInaction
} from './api';
import { ActionCards } from './components/ActionCards';
import { AdvisorPanel } from './components/AdvisorPanel';
import { BriefingPanel } from './components/BriefingPanel';
import { CommandInput, type CommandSubmitResult } from './components/CommandInput';
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

const pacingLabel: Record<'standard' | 'relaxed' | 'off', string> = {
  standard: 'Real-Time',
  relaxed: 'Extended',
  off: 'Untimed'
};

const normalizeCommand = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

interface IntelFeedEntry {
  id: string;
  channel: string;
  headline: string;
  detail?: string;
}

const clipLine = (value: string, max = 180): string =>
  value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;

const pickDeterministicWindow = <T,>(entries: T[], limit: number, anchor: number): T[] => {
  if (entries.length <= limit) {
    return entries;
  }

  const offset = Math.max(0, anchor) % entries.length;
  const selected: T[] = [];
  for (let index = 0; index < limit; index += 1) {
    selected.push(entries[(offset + index) % entries.length] as T);
  }
  return selected;
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
  const [intelExpandedMobile, setIntelExpandedMobile] = useState(false);
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

  const currentBeat = useMemo(() => {
    if (!reference || !episode) {
      return null;
    }
    const scenario = reference.scenarios.find((entry) => entry.id === episode.scenarioId);
    return scenario?.beats.find((beat) => beat.id === episode.currentBeatId) ?? null;
  }, [reference, episode?.scenarioId, episode?.currentBeatId]);
  const currentScenarioName = useMemo(() => {
    if (!reference || !episode) {
      return 'Unknown';
    }
    return reference.scenarios.find((entry) => entry.id === episode.scenarioId)?.name ?? 'Unknown';
  }, [reference, episode?.scenarioId]);

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
        seed?: string;
        timerMode: 'standard' | 'relaxed' | 'off';
      } = {
        profileId: profile.profileId,
        scenarioId: input.scenarioId,
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

  const handleCommandSubmit = useCallback(async (commandText: string): Promise<CommandSubmitResult> => {
    if (!episode) {
      return {
        message: 'No active episode detected. Begin an episode to issue commands.'
      };
    }

    if (loading || episode.status !== 'active') {
      return {
        message: 'Command channel is busy. Wait for current resolution to complete.'
      };
    }

    const normalized = normalizeCommand(commandText);
    const holdCommand = ['hold', 'stand by', 'standby', 'no action', 'take no action'].includes(normalized);
    if (holdCommand) {
      if (episode.timerMode === 'off' && currentBeat?.decisionWindow) {
        await handleInaction('explicit');
        return {
          message: 'Command accepted: holding position and taking no action for this beat.'
        };
      }
      return {
        message: 'Hold command recognized, but explicit no-action is only available on untimed decision beats.'
      };
    }

    setLoading(true);
    setError(null);
    try {
      const interpretation = await interpretEpisodeCommand(episode.episodeId, {
        expectedTurn: episode.turn,
        commandText
      });

      if (interpretation.stale) {
        setEpisode(interpretation.episode);
        return {
          message: 'Command target was stale. Synced to latest turn state.'
        };
      }

      if (interpretation.decision !== 'execute' || !interpretation.interpretedActionId) {
        const suggestionActions: ActionDefinition[] = interpretation.decision === 'review'
          ? interpretation.suggestions
            .map((suggestion) => episode.offeredActions.find((action) => action.id === suggestion.actionId))
            .filter((action): action is ActionDefinition => Boolean(action))
          : [];

        return {
          message: interpretation.message,
          decision: interpretation.decision,
          suggestions: suggestionActions
        };
      }

      const actionResponse = await submitAction(episode.episodeId, {
        expectedTurn: episode.turn,
        actionId: interpretation.interpretedActionId
      });

      if (actionResponse.stale) {
        setEpisode(actionResponse.episode);
        return {
          message: `${interpretation.message} State advanced before execution; command was not applied.`
        };
      }

      await applyEpisodeUpdate(actionResponse.episode);
      return {
        message: interpretation.message,
        decision: interpretation.decision
      };
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Command interpretation failed';
      setError(message);
      return {
        message
      };
    } finally {
      setLoading(false);
    }
  }, [applyEpisodeUpdate, currentBeat?.decisionWindow, episode, handleInaction, loading]);

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
  const countdownUrgencyLabel =
    countdownRatio === null ? 'No active window' : countdownRatio <= 0.25 ? 'Critical' : countdownRatio <= 0.5 ? 'Elevated' : 'Stable';
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
  const showExtendTimer = Boolean(episode.activeCountdown && episode.timerMode !== 'off');
  const showTakeNoAction =
    episode.status === 'active' &&
    episode.timerMode === 'off' &&
    Boolean(currentBeat?.decisionWindow);
  const extendPreviewSeconds = episode.activeCountdown ? Math.max(1, Math.round(episode.activeCountdown.seconds * 0.5)) : 0;
  const pressureText = (
    episode.activeCountdown &&
    remainingSeconds !== null &&
    remainingSeconds >= 0
  )
    ? pickPressureText(reference, episode.currentBeatId, remainingSeconds)
    : null;

  const beatIntelFragments = reference.intelFragments
    .filter((entry) => entry.beatId === episode.currentBeatId && (!currentBeat || entry.phase === currentBeat.phase))
    .sort((left, right) => left.id.localeCompare(right.id));
  const beatNewsArticles = reference.newsWire
    .filter((entry) => entry.beatId === episode.currentBeatId && (!currentBeat || entry.phase === currentBeat.phase))
    .sort((left, right) => left.id.localeCompare(right.id));

  const selectedIntelFragments = pickDeterministicWindow(beatIntelFragments, 2, episode.turn - 1);
  const selectedNewsArticles = pickDeterministicWindow(beatNewsArticles, 2, episode.turn + 1);

  const intelFeed: IntelFeedEntry[] = [
    ...episode.briefing.headlines.map((headline, index) => ({
      id: `brief:${index}`,
      channel: index === 0 ? 'Briefing' : 'Update',
      headline
    }))
  ];
  if (episode.briefing.memoLine) {
    intelFeed.push({
      id: 'memo',
      channel: 'Memo',
      headline: episode.briefing.memoLine
    });
  }
  if (episode.briefing.tickerLine) {
    intelFeed.push({
      id: 'ticker',
      channel: 'Market',
      headline: episode.briefing.tickerLine
    });
  }

  for (const fragment of selectedIntelFragments) {
    intelFeed.push({
      id: fragment.id,
      channel: `${fragment.sourceType} · ${fragment.confidence.toUpperCase()}`,
      headline: fragment.headline,
      detail: clipLine(fragment.analystNote ?? fragment.body)
    });
  }

  for (const article of selectedNewsArticles) {
    intelFeed.push({
      id: article.id,
      channel: `${article.outlet} · ${article.tone.toUpperCase()}`,
      headline: article.headline,
      detail: clipLine(article.lede)
    });
  }

  if (pressureText) {
    intelFeed.push({
      id: 'timer-pressure',
      channel: 'Timer',
      headline: pressureText
    });
  }
  const intelFeedVisible = intelExpandedMobile ? intelFeed.slice(0, 8) : intelFeed.slice(0, 3);

  return (
    <main className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 px-4 py-5 pb-24 sm:px-6 lg:pb-8">
      <header className="card overflow-hidden px-3 py-2.5 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2 text-textMuted">
            <span className="font-semibold text-textMain">{codename || profileId?.slice(0, 8) || 'Unknown'}</span>
            <span className="text-borderTone">|</span>
            <span>{currentScenarioName}</span>
            <span className="text-borderTone">|</span>
            <span>Turn {episode.turn}/{episode.maxTurns}</span>
            <span className="text-borderTone">|</span>
            <span>{pacingLabel[episode.timerMode]}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {episode.activeCountdown && remainingSeconds !== null ? (
              <div className="rounded-md border border-borderTone bg-panelRaised/70 px-2 py-1">
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-[0.76rem] ${countdownToneClass}`}>{formatSeconds(remainingSeconds)}</span>
                  <span className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">{countdownUrgencyLabel}</span>
                </div>
                <div className="mt-1 h-1 w-24 overflow-hidden rounded-sm bg-borderTone/70">
                  <div
                    className={`h-full transition-[width] duration-200 ${progressToneClass}`}
                    style={{
                      width: `${Math.max(0, Math.min(100, ((remainingSeconds / Math.max(1, episode.activeCountdown.seconds)) * 100)))}%`
                    }}
                  />
                </div>
              </div>
            ) : null}
            {showExtendTimer ? (
              <button
                type="button"
                className="rounded-md border border-borderTone px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-textMuted transition hover:border-accent hover:text-textMain disabled:cursor-not-allowed disabled:opacity-45"
                onClick={() => void handleExtendTimer()}
                disabled={!canExtendTimer}
              >
                Extend +{formatSeconds(extendPreviewSeconds)}
              </button>
            ) : null}
            {showTakeNoAction ? (
              <button
                type="button"
                className="rounded-md border border-warning/70 bg-warning/10 px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-warning transition hover:bg-warning/20 disabled:cursor-not-allowed disabled:opacity-45"
                onClick={() => void handleInaction('explicit')}
                disabled={loading || episode.status !== 'active'}
              >
                Take No Action
              </button>
            ) : null}
          </div>
        </div>
        {pressureText ? <p className="mt-2 text-[0.7rem] text-textMuted">{pressureText}</p> : null}
      </header>

      {error ? (
        <div className="rounded-lg border border-warning/70 bg-warning/10 px-3 py-2 text-sm text-warning">{error}</div>
      ) : null}

      <section className="grid gap-4 sm:gap-5 lg:grid-cols-[0.35fr_0.9fr_0.8fr]">
        <aside className="order-3 card p-4 lg:order-1">
          <div className="flex items-center justify-between">
            <p className="label">Intel Feed</p>
            <span className="text-[0.62rem] uppercase tracking-[0.12em] text-textMuted">Live</span>
          </div>
          <div className="mt-3 max-h-[32rem] space-y-2 overflow-y-auto pr-1 text-xs leading-relaxed text-textMuted">
            {intelFeed.length > 0 ? intelFeedVisible.map((item, index) => (
              <article key={`${item.id}:${index}`} className="rounded-md border border-borderTone/70 bg-panelRaised/45 px-2 py-1.5">
                <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">{item.channel}</p>
                <p className="mt-1 text-[0.72rem] text-textMain">{item.headline}</p>
                {item.detail ? (
                  <p className="mt-1 text-[0.67rem] text-textMuted">{item.detail}</p>
                ) : null}
              </article>
            )) : (
              <p className="rounded-md border border-borderTone/70 bg-panelRaised/45 px-2 py-1.5">
                Intelligence stream is stabilizing.
              </p>
            )}
          </div>
          {intelFeed.length > 3 ? (
            <button
              type="button"
              className="mt-3 rounded-md border border-borderTone px-2 py-1 text-[0.62rem] uppercase tracking-[0.1em] text-textMuted transition hover:border-accent hover:text-textMain lg:hidden"
              onClick={() => setIntelExpandedMobile((current) => !current)}
            >
              {intelExpandedMobile ? 'Show less' : `Show ${Math.min(5, intelFeed.length - 3)} more`}
            </button>
          ) : null}
        </aside>

        <div className="order-1 lg:order-2">
          <BriefingPanel
            turn={episode.turn}
            maxTurns={episode.maxTurns}
            briefing={episode.briefing}
            imageAsset={episode.imageAsset}
            turnDebrief={episode.turnDebrief}
          />
        </div>

        <div className="order-2 space-y-4 sm:space-y-5 lg:order-3">
          <AdvisorPanel beat={currentBeat} />
          <ActionCards
            actions={episode.offeredActions}
            disabled={loading || episode.status !== 'active'}
            onSelect={handleActionSelect}
          />
        </div>
      </section>

      <section className="sticky bottom-3 z-20">
        <CommandInput
          turn={episode.turn}
          actions={episode.offeredActions}
          disabled={loading || episode.status !== 'active'}
          onSubmitCommand={handleCommandSubmit}
          onSelectAction={handleActionSelect}
        />
      </section>
    </main>
  );
};

export default App;
