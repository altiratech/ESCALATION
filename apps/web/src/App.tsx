import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  ActionDefinition,
  ActionNarrativePhaseContent,
  BeatPhase,
  BootstrapPayload,
  CinematicPhaseTransitionKey,
  EpisodeView,
  PostGameReport
} from '@wargames/shared-types';

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
import { IntelPanel } from './components/IntelPanel';
import { MeterDashboard } from './components/MeterDashboard';
import { ReportView } from './components/ReportView';
import { StartScreen } from './components/StartScreen';
import { getAdvisorActionReads } from './lib/decisionSupport';

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

type TurnStage = 'brief' | 'decision';

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

const actionNarrativePhaseOrder = (phase: BeatPhase | null | undefined): BeatPhase[] => {
  if (phase === 'resolution') {
    return ['climax', 'crisis', 'rising', 'opening'];
  }
  if (!phase) {
    return ['crisis', 'rising', 'opening'];
  }
  return [phase, 'climax', 'crisis', 'rising', 'opening'].filter(
    (value, index, array): value is BeatPhase => array.indexOf(value) === index
  );
};

const formatPhaseLabel = (phase: BeatPhase): string => phase.charAt(0).toUpperCase() + phase.slice(1);

interface RecentActionNarrativeView {
  actionName: string;
  phaseLabel: string;
  detail: ActionNarrativePhaseContent;
}

const App = () => {
  const [reference, setReference] = useState<BootstrapPayload | null>(null);
  const [episode, setEpisode] = useState<EpisodeView | null>(null);
  const [report, setReport] = useState<PostGameReport | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [turnStage, setTurnStage] = useState<TurnStage>('brief');

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

  const currentScenario = useMemo(() => {
    if (!reference || !episode) {
      return null;
    }
    return reference.scenarios.find((entry) => entry.id === episode.scenarioId) ?? null;
  }, [reference, episode?.scenarioId]);
  const currentBeat = useMemo(() => {
    if (!currentScenario || !episode) {
      return null;
    }
    return currentScenario.beats.find((beat) => beat.id === episode.currentBeatId) ?? null;
  }, [currentScenario, episode?.currentBeatId]);
  const currentScenarioName = useMemo(() => {
    if (!currentScenario) {
      return 'Unknown';
    }
    return currentScenario.name;
  }, [currentScenario]);
  const currentCinematics = useMemo(() => {
    if (!reference || !episode) {
      return null;
    }
    return reference.cinematics.find((entry) => entry.scenarioId === episode.scenarioId) ?? null;
  }, [reference, episode?.scenarioId]);
  const currentScenarioWorld = useMemo(() => {
    if (!reference || !episode) {
      return null;
    }
    return reference.scenarioWorld.find((entry) => entry.scenarioId === episode.scenarioId) ?? null;
  }, [reference, episode?.scenarioId]);
  const currentCounterpart = useMemo(() => {
    if (!reference || !episode) {
      return null;
    }
    return reference.rivalLeaders.find((entry) => entry.scenarioId === episode.scenarioId) ?? null;
  }, [reference, episode?.scenarioId]);
  const activeAdvisorDossiers = useMemo(() => {
    if (!currentBeat || !reference) {
      return [];
    }

    return Object.keys(currentBeat.advisorLines)
      .map((advisorId) => reference.advisorDossiers.find((entry) => entry.id === advisorId))
      .filter((entry): entry is BootstrapPayload['advisorDossiers'][number] => Boolean(entry));
  }, [currentBeat, reference]);
  const actionAdvisorReadsByActionId = useMemo(() => {
    const readsByActionId = new Map<string, ReturnType<typeof getAdvisorActionReads>>();

    if (!episode) {
      return readsByActionId;
    }

    for (const action of episode.offeredActions) {
      readsByActionId.set(action.id, getAdvisorActionReads(action, activeAdvisorDossiers));
    }

    return readsByActionId;
  }, [activeAdvisorDossiers, episode?.offeredActions]);
  const selectedAction = episode?.offeredActions.find((action) => action.id === selectedActionId) ?? null;
  const actionAdvisorSummaries = useMemo(() => {
    const summaries = new Map<string, { supports: number; cautions: number; opposes: number }>();

    for (const [actionId, reads] of actionAdvisorReadsByActionId.entries()) {
      summaries.set(
        actionId,
        reads.reduce(
          (totals, read) => {
            totals[read.alignment] += 1;
            return totals;
          },
          { supports: 0, cautions: 0, opposes: 0 }
        )
      );
    }

    return summaries;
  }, [actionAdvisorReadsByActionId]);
  const recentActionNarrative = useMemo<RecentActionNarrativeView | null>(() => {
    if (!reference || !currentScenario || !episode?.recentTurn) {
      return null;
    }

    const action = reference.actions.find((entry) => entry.id === episode.recentTurn?.playerActionId);
    const actionNarrative = reference.actionNarratives.find((entry) => entry.actionId === episode.recentTurn?.playerActionId);
    const beatBefore = currentScenario.beats.find((beat) => beat.id === episode.recentTurn?.beatIdBefore);

    if (!action || !actionNarrative) {
      return null;
    }

    const detail = actionNarrativePhaseOrder(beatBefore?.phase).reduce<ActionNarrativePhaseContent | null>(
      (selected, phase) => selected ?? actionNarrative.phases[phase] ?? null,
      null
    );

    if (!detail) {
      return null;
    }

    return {
      actionName: action.name,
      phaseLabel: beatBefore?.phase ?? 'crisis',
      detail
    };
  }, [currentScenario, episode?.recentTurn, reference]);
  const phaseTransition = useMemo(() => {
    if (!currentScenario || !currentBeat || !currentCinematics || !episode?.recentTurn) {
      return null;
    }

    const previousBeat = currentScenario.beats.find((beat) => beat.id === episode.recentTurn?.beatIdBefore);
    if (!previousBeat || previousBeat.phase === currentBeat.phase) {
      return null;
    }

    const transitionKey = `${previousBeat.phase}_to_${currentBeat.phase}` as CinematicPhaseTransitionKey;
    const transition = currentCinematics.phaseTransitions[transitionKey];
    if (!transition) {
      return null;
    }

    return {
      key: transitionKey,
      fromLabel: formatPhaseLabel(previousBeat.phase),
      toLabel: formatPhaseLabel(currentBeat.phase),
      fragments: transition.fragments
    };
  }, [currentBeat, currentCinematics, currentScenario, episode?.recentTurn]);

  const applyEpisodeUpdate = useCallback(async (nextEpisode: EpisodeView): Promise<void> => {
    setEpisode(nextEpisode);
    setSelectedActionId(null);
    setTurnStage('brief');
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

  const handleActionSelect = useCallback(async (actionId: string): Promise<void> => {
    setSelectedActionId(actionId);
  }, []);

  const handleActionCommit = async (): Promise<void> => {
    if (!episode) {
      return;
    }
    if (!selectedActionId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await submitAction(episode.episodeId, {
        expectedTurn: episode.turn,
        actionId: selectedActionId
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
    setSelectedActionId((current) => {
      if (!episode) {
        return null;
      }
      return episode.offeredActions.some((action) => action.id === current) ? current : null;
    });
  }, [episode?.episodeId, episode?.turn, episode?.currentBeatId, episode?.offeredActions]);

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
    setSelectedActionId(null);
    setTurnStage('brief');
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
        setSelectedActionId(null);
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
      setSelectedActionId(interpretation.interpretedActionId);
      return {
        message: `${interpretation.message} Review the selected action and commit when ready.`,
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
    return (
      <ReportView
        report={report}
        scenario={currentScenario}
        advisorDossiers={reference.advisorDossiers}
        cinematics={currentCinematics}
        onRestart={reset}
      />
    );
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
  const intelFeedVisible = intelExpandedMobile ? intelFeed : intelFeed.slice(0, 6);
  const rangeValues = Object.values(episode.visibleRanges);
  const averageIntelConfidence = Math.round(
    rangeValues.reduce((total, range) => total + range.confidence, 0) / Math.max(1, rangeValues.length)
  );
  const escalationStateLabel =
    episode.meters.escalationIndex >= 75
      ? 'Critical'
      : episode.meters.escalationIndex >= 55
        ? 'Elevated'
        : 'Managed';
  const allianceStateLabel =
    episode.meters.allianceTrust >= 68
      ? 'Aligned'
      : episode.meters.allianceTrust >= 45
        ? 'Strained'
        : 'Fractured';
  const marketComposite = Math.round((episode.meters.economicStability + episode.meters.energySecurity) / 2);
  const marketStressLabel =
    marketComposite >= 65
      ? 'Contained'
      : marketComposite >= 45
        ? 'Elevated'
        : 'Severe';
  const intelStateLabel =
    averageIntelConfidence >= 80
      ? 'High Confidence'
      : averageIntelConfidence >= 60
        ? 'Working Estimate'
        : 'Fragmentary';
  const theaterTimeContext = currentScenarioWorld?.dateAnchor.timeContext ?? null;
  const currentDirective = currentScenario?.briefing ?? currentScenarioWorld?.economicBackdrop.straitEconomicValue ?? '';
  const missionObjectives = currentScenario?.missionObjectives ?? [];
  const turnResolutionGuidance =
    episode.activeCountdown && remainingSeconds !== null
      ? `Select one action, inspect the tradeoffs, and commit before ${formatSeconds(remainingSeconds)} elapses.`
      : showTakeNoAction
        ? 'Select one action and commit it, or use Take No Action to hold position.'
        : 'Select one action from the decision rail, inspect the detail, and commit to resolve the turn.';
  const turnProcedure = [
    {
      label: 'Read',
      detail: 'Use the situation report and intel feed to understand the current pressure.'
    },
    {
      label: 'Decide',
      detail: turnResolutionGuidance
    },
    {
      label: 'Review',
      detail: 'After resolution, check the turn assessment and operational readout for immediate consequences.'
    }
  ];
  const turnStageLabel = turnStage === 'brief' ? 'Turn Brief' : 'Decision';
  const turnStageActionLabel = turnStage === 'brief'
    ? selectedAction
      ? 'Return To Selected Response'
      : 'Proceed To Decision'
    : 'Back To Brief';

  return (
    <main className="mx-auto flex w-full max-w-[1680px] flex-col gap-4 px-3 py-3 pb-8 sm:px-4 lg:px-5">
      <header className="console-topbar px-3 py-3 sm:px-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-1">
            <p className="label">Altira Flashpoint // War Room</p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-textMuted">
              <span className="font-display text-xl text-textMain">{currentScenarioName}</span>
              <span className="text-borderTone">/</span>
              <span>{currentScenario?.role ?? 'Decision Simulation'}</span>
              <span className="text-borderTone">/</span>
              <span>{pacingLabel[episode.timerMode]}</span>
            </div>
            {theaterTimeContext ? (
              <p className="max-w-4xl text-[0.72rem] leading-relaxed text-textMuted">{theaterTimeContext}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="console-chip">
              <strong>Clock</strong>
              <span className={countdownToneClass}>
                {episode.activeCountdown && remainingSeconds !== null ? formatSeconds(remainingSeconds) : 'Standby'}
              </span>
            </div>
            <div className="console-chip">
              <strong>Intel</strong>
              <span>{intelStateLabel}</span>
            </div>
            <div className="console-chip">
              <strong>Step</strong>
              <span>{turnStageLabel}</span>
            </div>
            <div className="console-chip">
              <strong>Selected</strong>
              <span>{selectedAction?.name ?? 'Awaiting decision'}</span>
            </div>
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

        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <div className="console-metric">
            <p className="console-metric-label">Turn</p>
            <p className="console-metric-value">{episode.turn}/{episode.maxTurns}</p>
          </div>
          <div className="console-metric">
            <p className="console-metric-label">Escalation</p>
            <p className="console-metric-value">{escalationStateLabel}</p>
          </div>
          <div className="console-metric">
            <p className="console-metric-label">Alliance</p>
            <p className="console-metric-value">{allianceStateLabel}</p>
          </div>
          <div className="console-metric">
            <p className="console-metric-label">Market Stress</p>
            <p className="console-metric-value">{marketStressLabel}</p>
          </div>
          <div className="console-metric">
            <p className="console-metric-label">Decision Window</p>
            <p className="console-metric-value">
              {episode.activeCountdown && remainingSeconds !== null ? countdownUrgencyLabel : episode.timerMode === 'off' ? 'Player Held' : 'Closed'}
            </p>
          </div>
        </div>

        {episode.activeCountdown && remainingSeconds !== null ? (
          <div className="mt-3 h-1.5 overflow-hidden rounded-sm bg-borderTone/70">
            <div
              className={`h-full transition-[width] duration-200 ${progressToneClass}`}
              style={{
                width: `${Math.max(0, Math.min(100, ((remainingSeconds / Math.max(1, episode.activeCountdown.seconds)) * 100)))}%`
              }}
            />
          </div>
        ) : null}
        {pressureText ? <p className="mt-2 text-[0.7rem] text-textMuted">{pressureText}</p> : null}
      </header>

      {error ? (
        <div className="rounded-md border border-warning/70 bg-warning/10 px-3 py-2 text-sm text-warning">{error}</div>
      ) : null}

      {turnStage === 'brief' ? (
        <>
          <section className="console-panel px-3 py-3 sm:px-4">
            <div className="flex flex-col gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="label text-accent">Turn Brief</p>
                  <span className="action-required-status border-accent/55 bg-accent/10 text-accent">
                    Review Before Deciding
                  </span>
                </div>
                <p className="mt-2 text-[0.82rem] leading-relaxed text-textMain">{clipLine(currentDirective, 220)}</p>
                <p className="mt-2 text-[0.72rem] leading-relaxed text-textMuted">
                  Review the live briefing, intelligence feed, mandate, and confidence surfaces below. When you are ready,
                  continue to the decision page to consult advisors and choose a response.
                </p>
              </div>
            </div>
          </section>

          <section className="console-panel console-panel-muted px-3 py-3 sm:px-4">
            <div className="grid gap-3 xl:grid-cols-[1.02fr_0.98fr]">
              <div className="min-w-0">
                <p className="label">Mission Mandate</p>
                <p className="mt-2 text-sm leading-relaxed text-textMain">{clipLine(currentDirective, 220)}</p>
                <p className="mt-2 text-[0.72rem] leading-relaxed text-textMuted">
                  Strategic success is measured against the mandate below, not simply whether the turn resolves without immediate escalation.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {missionObjectives.length > 0
                  ? missionObjectives.map((objective) => (
                      <div key={objective.id} className="console-subpanel px-3 py-2.5">
                        <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">{objective.label}</p>
                        <p className="mt-1 text-[0.72rem] leading-relaxed text-textMain">{objective.description}</p>
                      </div>
                    ))
                  : turnProcedure.map((item) => (
                      <div key={item.label} className="console-subpanel px-3 py-2.5">
                        <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">{item.label}</p>
                        <p className="mt-1 text-[0.72rem] leading-relaxed text-textMain">{item.detail}</p>
                      </div>
                    ))}
              </div>
            </div>
          </section>

          <section className="grid min-h-0 gap-4 xl:grid-cols-[0.34fr_0.94fr]">
            <aside className="console-panel console-panel-muted order-2 flex min-h-[36rem] flex-col p-3 xl:order-1">
              <div className="flex items-center justify-between">
                <p className="label">Intel Feed</p>
                <span className="text-[0.62rem] uppercase tracking-[0.12em] text-textMuted">Live</span>
              </div>
              <div className="console-scroll mt-3 flex-1 space-y-2 overflow-y-auto pr-1 text-xs leading-relaxed text-textMuted">
                {intelFeed.length > 0 ? intelFeedVisible.map((item, index) => (
                  <article key={`${item.id}:${index}`} className="console-feed-item">
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
                  {intelExpandedMobile ? 'Show less' : `Show ${Math.max(1, Math.min(intelFeed.length - 6, 6))} more`}
                </button>
              ) : null}
            </aside>

            <div className="order-1 min-h-[40rem] xl:order-2">
              <BriefingPanel
                turn={episode.turn}
                briefing={episode.briefing}
                scenarioWorld={currentScenarioWorld}
                counterpartBrief={currentCounterpart}
                imageAsset={episode.imageAsset}
                turnDebrief={episode.turnDebrief}
                recentActionNarrative={recentActionNarrative}
                phaseTransition={phaseTransition}
              />
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <MeterDashboard
              meters={episode.meters}
              previousMeters={episode.recentTurn?.meterBefore}
              visibleRanges={episode.visibleRanges}
            />
            <IntelPanel ranges={episode.visibleRanges} intelQuality={episode.intelQuality} turn={episode.turn} />
          </section>

          <section className="console-panel px-3 py-3 sm:px-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="label">Decision Phase</p>
                <p className="mt-2 text-[0.76rem] leading-relaxed text-textMuted">
                  Continue when you are ready to consult the advisors, compare responses, and commit a turn action.
                </p>
              </div>
              <button
                type="button"
                className="console-button console-button-info min-w-[12.5rem]"
                onClick={() => setTurnStage('decision')}
                disabled={loading || episode.status !== 'active'}
              >
                {turnStageActionLabel}
              </button>
            </div>
          </section>
        </>
      ) : (
        <section
          className={`action-required-shell px-3 py-3 sm:px-4 ${
            selectedAction ? 'action-required-shell-ready' : 'action-required-shell-awaiting'
          }`}
        >
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="relative z-[1] min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="label text-accent">Decision Phase</p>
                <span
                  className={`action-required-status ${
                    selectedAction
                      ? 'border-positive/65 bg-positive/10 text-positive'
                      : 'border-accent/55 bg-accent/10 text-accent'
                  }`}
                >
                  {selectedAction ? 'Ready To Commit' : 'Awaiting Response'}
                </span>
              </div>
              <p className="mt-2 text-[0.82rem] leading-relaxed text-textMain">{clipLine(currentDirective, 220)}</p>
              <p className="mt-2 text-sm leading-relaxed text-textMain">
                Compare the available responses, inspect advisor reasoning, then commit a selected response to advance the turn.
              </p>
              <p className="mt-2 text-[0.72rem] leading-relaxed text-textMuted">
                Need more context first? Return to the Turn Brief to review the full intelligence and mandate surfaces before you commit.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="action-required-step">
                  <p className="text-[0.56rem] uppercase tracking-[0.12em] text-accent">1. Select</p>
                  <p className="mt-1 text-[0.7rem] leading-relaxed text-textMain">Choose one response from the selector.</p>
                </div>
                <div className="action-required-step">
                  <p className="text-[0.56rem] uppercase tracking-[0.12em] text-accent">2. Consult</p>
                  <p className="mt-1 text-[0.7rem] leading-relaxed text-textMain">Open advisor cards to review the reasoning behind the selected response.</p>
                </div>
                <div className="action-required-step">
                  <p className="text-[0.56rem] uppercase tracking-[0.12em] text-accent">3. Commit</p>
                  <p className="mt-1 text-[0.7rem] leading-relaxed text-textMain">Advance the turn only after you are satisfied with the selected response.</p>
                </div>
              </div>
            </div>
            <div className="relative z-[1] flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                className="console-button console-button-secondary min-w-[12.5rem]"
                onClick={() => setTurnStage('brief')}
                disabled={loading}
              >
                Back To Brief
              </button>
              <div
                className={`console-chip ${
                  selectedAction ? 'border-positive/45 bg-positive/8' : 'border-accent/50 bg-accent/8'
                }`}
              >
                <strong>Decision</strong>
                <span>{selectedAction?.name ?? 'Choose a response'}</span>
              </div>
              <button
                type="button"
                className={`console-button ${selectedAction ? 'console-button-primary' : 'console-button-secondary'} min-w-[12.5rem]`}
                onClick={() => void handleActionCommit()}
                disabled={!selectedAction || loading || episode.status !== 'active'}
              >
                {selectedAction ? 'Commit Selected Response' : 'Select A Response'}
              </button>
            </div>
          </div>

          <div className="relative z-[1] mt-4 grid min-h-0 gap-4 xl:grid-cols-[1.06fr_0.72fr]">
            <ActionCards
              actions={episode.offeredActions}
              disabled={loading || episode.status !== 'active'}
              selectedActionId={selectedActionId}
              actionAdvisorSummaries={actionAdvisorSummaries}
              onSelect={(actionId) => {
                void handleActionSelect(actionId);
              }}
            />
            <AdvisorPanel
              beat={currentBeat}
              scenarioId={episode.scenarioId}
              advisorDossiers={reference.advisorDossiers}
              selectedAction={selectedAction}
            />
          </div>

          <div className="relative z-[1] mt-4 border-t border-accent/25 pt-4">
            <CommandInput
              turn={episode.turn}
              disabled={loading || episode.status !== 'active'}
              onSubmitCommand={handleCommandSubmit}
              onSelectAction={handleActionSelect}
            />
          </div>
        </section>
      )}
    </main>
  );
};

export default App;
