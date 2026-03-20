import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  ActionDefinition,
  ActionNarrativePhaseContent,
  ActionVariantDefinition,
  BeatNode,
  BeatPhase,
  BootstrapPayload,
  CinematicPhaseTransitionKey,
  EpisodeView,
  ImageAsset,
  MeterKey,
  MeterState,
  ScenarioContextSection,
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
import { CommandInput, type CommandSubmitResult, type CommandSuggestion } from './components/CommandInput';
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
const normalizeTickerLine = (value: string): string => value.replace(/^(risk|market)\s+ticker:\s*/i, '').trim();

const previewImageKinds: ImageAsset['kind'][] = ['scenario_still', 'documentary_still', 'artifact', 'map'];

const previewImageRealismScore = (asset: ImageAsset): number => {
  if (asset.id.startsWith('img_')) {
    return -10;
  }

  const lowerPath = asset.path.toLowerCase();
  if (lowerPath.endsWith('.svg')) {
    return -18;
  }

  if (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg') || lowerPath.endsWith('.png') || lowerPath.endsWith('.webp')) {
    return 8;
  }

  if (asset.kind === 'map' || asset.kind === 'artifact') {
    return 0;
  }

  return 0;
};

const isPhotorealAsset = (asset: ImageAsset): boolean => {
  const lowerPath = asset.path.toLowerCase();
  return (
    !asset.id.startsWith('img_') &&
    (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg') || lowerPath.endsWith('.png') || lowerPath.endsWith('.webp'))
  );
};

const heroVisualScore = (asset: ImageAsset): number => {
  let score = 0;

  if (asset.kind === 'documentary_still') {
    score += 18;
  } else if (asset.kind === 'scenario_still') {
    score += 16;
  } else if (asset.kind === 'map') {
    score -= 6;
  } else if (asset.kind === 'artifact') {
    score -= 8;
  }

  if (isPhotorealAsset(asset)) {
    score += 12;
  }

  if (asset.id.startsWith('img_')) {
    score -= 12;
  }

  const lowerPerspective = String(asset.perspective).toLowerCase();
  if (lowerPerspective === 'news_frame' || lowerPerspective === 'street') {
    score += 5;
  } else if (lowerPerspective === 'satellite' || lowerPerspective === 'surveillance') {
    score += 2;
  } else if (lowerPerspective === 'memo' || lowerPerspective === 'ticker') {
    score -= 3;
  }

  const tags = new Set(asset.tags.map((tag) => tag.toLowerCase()));
  for (const tag of ['incident', 'boarding', 'shipping', 'tail_risk', 'warning_time', 'watchfloor', 'cic']) {
    if (tags.has(tag)) {
      score += 2;
    }
  }

  return score;
};

const evidenceVisualScore = (asset: ImageAsset, heroAsset: ImageAsset | null): number => {
  let score = 0;
  const lowerPerspective = String(asset.perspective).toLowerCase();

  if (asset.kind === 'artifact') {
    score += 12;
  } else if (asset.kind === 'map') {
    score += 9;
  } else if (lowerPerspective === 'satellite' || lowerPerspective === 'surveillance') {
    score += 8;
  } else if (lowerPerspective === 'memo' || lowerPerspective === 'ticker') {
    score += 7;
  } else {
    score += 4;
  }

  if (isPhotorealAsset(asset)) {
    score += 4;
  }

  if (asset.id.startsWith('img_')) {
    score -= 10;
  }

  if (heroAsset) {
    if (heroAsset.kind === asset.kind) {
      score -= 4;
    }
    if (String(heroAsset.perspective).toLowerCase() === lowerPerspective) {
      score -= 3;
    }
  }

  return score;
};

const arrangeBriefingVisuals = (
  primaryAsset: ImageAsset | null,
  supportingAssets: ImageAsset[]
): {
  heroAsset: ImageAsset | null;
  evidenceAssets: ImageAsset[];
} => {
  const pool = [primaryAsset, ...supportingAssets].filter((asset): asset is ImageAsset => Boolean(asset));
  const deduped = pool.filter((asset, index, array) => array.findIndex((entry) => entry.id === asset.id) === index);

  if (deduped.length === 0) {
    return {
      heroAsset: null,
      evidenceAssets: []
    };
  }

  const primaryIsStrongScene =
    primaryAsset &&
    !primaryAsset.id.startsWith('img_') &&
    primaryAsset.kind !== 'map' &&
    primaryAsset.kind !== 'artifact';

  const heroAsset = primaryIsStrongScene
    ? primaryAsset
    : ([...deduped].sort(
        (left, right) => heroVisualScore(right) - heroVisualScore(left) || left.id.localeCompare(right.id)
      )[0] ??
      null);

  const evidenceAssets = deduped
    .filter((asset) => asset.id !== heroAsset?.id)
    .sort(
      (left, right) =>
        evidenceVisualScore(right, heroAsset) - evidenceVisualScore(left, heroAsset) || left.id.localeCompare(right.id)
    )
    .slice(0, 2);

  return {
    heroAsset,
    evidenceAssets
  };
};

const rankedCuratedPreviewAssets = (
  candidates: Array<{ asset: ImageAsset; score: number }>,
  ids: string[] | undefined
): Array<{ asset: ImageAsset; score: number }> => {
  if (!ids || ids.length === 0) {
    return [];
  }

  const candidatesById = new Map(candidates.map((entry) => [entry.asset.id, entry]));
  return ids
    .map((id) => candidatesById.get(id))
    .filter((entry): entry is { asset: ImageAsset; score: number } => Boolean(entry));
};

const pickPreviewImageAssets = (
  reference: BootstrapPayload | null,
  scenario: BootstrapPayload['scenarios'][number] | null,
  beat: BeatNode | null,
  options?: {
    recentImageIds?: string[];
    selectedAction?: ActionDefinition | null;
    selectedVariant?: ActionVariantDefinition | null;
  },
  count = 3
): ImageAsset[] => {
  if (!reference || !scenario || !beat) {
    return [];
  }

  const recentImageIds = options?.recentImageIds ?? [];
  const preferredKinds = beat.visualCue?.preferredKinds?.length ? beat.visualCue.preferredKinds : previewImageKinds;
  const requestedTags = new Set(
    [
      ...(beat.imageHints ?? []),
      ...(beat.visualCue?.tags ?? []),
      ...(options?.selectedAction?.visualTags ?? []),
      ...(options?.selectedVariant?.visualTags ?? []),
      `phase_${beat.phase}`,
      beat.visualCue?.branchStage ? `branch_${beat.visualCue.branchStage}` : null
    ]
      .filter((tag): tag is string => Boolean(tag))
      .map((tag) => tag.toLowerCase())
  );

  const scoreCandidate = (asset: ImageAsset): { asset: ImageAsset; score: number } => {
    const kindScore = preferredKinds.includes(asset.kind)
      ? (preferredKinds.length - preferredKinds.indexOf(asset.kind)) * 6
      : 0;
    const tagScore = asset.tags.reduce(
      (score, tag) => score + (requestedTags.has(tag.toLowerCase()) ? 4 : 0),
      0
    );
    const mapPenalty =
      asset.kind === 'map' && preferredKinds[0] !== 'map' && !requestedTags.has('map') ? -6 : 0;
    const realismScore = previewImageRealismScore(asset);
    const recentPenalty = recentImageIds.includes(asset.id) ? -12 : 0;

    return {
      asset,
      score: kindScore + tagScore + mapPenalty + realismScore + recentPenalty
    };
  };

  const scopedAssets = reference.images.filter(
    (asset) => asset.environment === scenario.environment || asset.environment === 'generic'
  );
  const allCandidates = scopedAssets
    .map((asset) => {
      const candidate = scoreCandidate(asset);
      return {
        ...candidate,
        score: candidate.score + (recentImageIds.includes(asset.id) ? 12 : 0)
      };
    })
    .sort((left, right) => right.score - left.score || left.asset.id.localeCompare(right.asset.id));
  const candidates = scopedAssets
    .map((asset) => scoreCandidate(asset))
    .sort((left, right) => right.score - left.score || left.asset.id.localeCompare(right.asset.id));

  const selected: ImageAsset[] = [];
  const usedKinds = new Set<ImageAsset['kind']>();
  const usedPerspectives = new Set<ImageAsset['perspective']>();

  const curatedHero = rankedCuratedPreviewAssets(allCandidates, beat.visualCue?.heroImageIds);
  if (curatedHero.length > 0) {
    selected.push(curatedHero[0]!.asset);
    usedKinds.add(curatedHero[0]!.asset.kind);
    usedPerspectives.add(curatedHero[0]!.asset.perspective);
  }

  const curatedEvidence = rankedCuratedPreviewAssets(allCandidates, beat.visualCue?.evidenceImageIds).filter(
    (entry) => !selected.some((asset) => asset.id === entry.asset.id)
  );

  for (const candidate of curatedEvidence) {
    if (selected.length >= count) {
      break;
    }

    selected.push(candidate.asset);
    usedKinds.add(candidate.asset.kind);
    usedPerspectives.add(candidate.asset.perspective);
  }

  for (const candidate of candidates) {
    if (selected.length >= count) {
      break;
    }
    if (selected.length > 0 && candidate.score <= 0) {
      continue;
    }

    const diversityPenalty =
      (usedKinds.has(candidate.asset.kind) ? 3 : 0) +
      (usedPerspectives.has(candidate.asset.perspective) ? 2 : 0);
    if (selected.length > 0 && candidate.score - diversityPenalty < 4) {
      continue;
    }

    selected.push(candidate.asset);
    usedKinds.add(candidate.asset.kind);
    usedPerspectives.add(candidate.asset.perspective);
  }

  if (selected.length < count) {
    for (const candidate of candidates) {
      if (selected.length >= count) {
        break;
      }
      if (selected.some((asset) => asset.id === candidate.asset.id)) {
        continue;
      }
      selected.push(candidate.asset);
    }
  }

  if (selected.length > 0) {
    return selected;
  }

  return reference.images.filter(
    (asset) =>
      (asset.environment === scenario.environment || asset.environment === 'generic') &&
      asset.kind !== 'map'
  ).slice(0, count);
};

const buildDynamicContextSections = (
  turn: number,
  meters: MeterState,
  previousMeters?: MeterState
): ScenarioContextSection[] => {
  const meterChanges = previousMeters
    ? ([
        { key: 'economicStability', delta: meters.economicStability - previousMeters.economicStability },
        { key: 'energySecurity', delta: meters.energySecurity - previousMeters.energySecurity },
        { key: 'domesticCohesion', delta: meters.domesticCohesion - previousMeters.domesticCohesion },
        { key: 'militaryReadiness', delta: meters.militaryReadiness - previousMeters.militaryReadiness },
        { key: 'allianceTrust', delta: meters.allianceTrust - previousMeters.allianceTrust },
        { key: 'escalationIndex', delta: meters.escalationIndex - previousMeters.escalationIndex }
      ] satisfies Array<{ key: MeterKey; delta: number }>)
    : [];

  const shifts: Array<{ key: MeterKey; delta: number }> = previousMeters
    ? meterChanges
        .filter((entry) => Math.abs(entry.delta) >= 2)
        .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
        .slice(0, 2)
    : [];

  const changeSection: ScenarioContextSection =
    shifts.length > 0
      ? {
          id: 'window_change',
          title: 'What Shifted Under The Surface',
          body: shifts
            .map((entry) => {
              if (entry.key === 'economicStability') {
                return entry.delta < 0
                  ? 'Commercial actors stopped treating the disruption like a bluff and started planning around real delay, reroute, and inventory pain.'
                  : 'Commercial stress eased slightly, which buys the room a little time before panic starts writing the script.';
              }
              if (entry.key === 'energySecurity') {
                return entry.delta < 0
                  ? 'Fuel and logistics planners absorbed a new shock, which is how a regional scare starts bleeding into everyday operating decisions.'
                  : 'Fuel and logistics pressure steadied just enough to keep the room from feeling one shock away from visible disruption.';
              }
              if (entry.key === 'domesticCohesion') {
                return entry.delta < 0
                  ? 'Domestic tolerance weakened, which means the next visible shock could leave the secure room and land in ordinary life.'
                  : 'Domestic nerves held for another window, which matters because panic at home can wreck strategy abroad.';
              }
              if (entry.key === 'militaryReadiness') {
                return entry.delta > 0
                  ? 'Military posture became more visible, which can steady deterrence or make the next misread far more dangerous.'
                  : 'Military posture softened slightly, preserving reversibility but inviting a harder test if the other side reads caution as hesitation.';
              }
              if (entry.key === 'allianceTrust') {
                return entry.delta < 0
                  ? 'Coalition discipline weakened, so the same event may now be landing as caution in one capital and alarm in another.'
                  : 'Coalition messaging tightened, which helps because markets and commanders punish mixed signals fast.';
              }
              return entry.delta > 0
                ? 'Hotlines, pilots, insurers, and political staffs are all feeling a tighter clock now.'
                : 'The pace eased for a moment, but nobody in the room thinks that means the danger has passed.';
            })
            .join(' ')
        }
      : {
          id: 'window_change',
          title: 'What Shifted Under The Surface',
          body:
            turn === 1
              ? 'The background pressure is over. The room is now reacting to a live signal that could still prove manageable or become the first step into something much worse.'
              : 'Nothing snapped cleanly this window. That is what makes the accumulation dangerous.'
        };

  const currentPressureSentences: string[] = [];
  if (meters.escalationIndex >= 60) {
    currentPressureSentences.push('Escalation pressure is elevated, so mixed or delayed signals carry a higher chance of misread.');
  }
  if (meters.allianceTrust < 55) {
    currentPressureSentences.push('Allied cohesion is under strain, so visible moves will be judged for discipline as much as resolve.');
  }
  if (meters.economicStability < 60) {
    currentPressureSentences.push('Commercial and market channels are already repricing risk before any formal blockade, which raises the cost of drift.');
  }
  if (meters.militaryReadiness >= 65) {
    currentPressureSentences.push('Military posture is becoming more operationally relevant, which can stabilize deterrence or accelerate a collision if misread.');
  }
  if (currentPressureSentences.length === 0) {
    currentPressureSentences.push('The room is still holding together, but one badly framed move could change how allies, shippers, and markets read the whole crisis.');
  }

  return [
    changeSection,
    {
      id: 'current_pressure',
      title: 'What Could Crack Next',
      body: currentPressureSentences.slice(0, 2).join(' ')
    }
  ];
};

interface IntelFeedEntry {
  id: string;
  channel: string;
  headline: string;
  detail?: string;
}

type TurnStage = 'brief' | 'decision';

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

const resolveActionNarrativeDetail = (
  narratives: BootstrapPayload['actionNarratives'],
  actionId: string,
  phase: BeatPhase | null | undefined
): ActionNarrativePhaseContent | null => {
  const actionNarrative = narratives.find((entry) => entry.actionId === actionId);
  if (!actionNarrative) {
    return null;
  }

  return actionNarrativePhaseOrder(phase).reduce<ActionNarrativePhaseContent | null>(
    (selected, currentPhase) => selected ?? actionNarrative.phases[currentPhase] ?? null,
    null
  );
};

const formatPhaseLabel = (phase: BeatPhase): string => phase.charAt(0).toUpperCase() + phase.slice(1);

interface RecentActionNarrativeView {
  actionName: string;
  phaseLabel: string;
  detail: ActionNarrativePhaseContent;
}

interface ResolvedActionOutcomeContext {
  label: string;
  summary: string | null;
  hiddenDownsideCategory: string | null;
  narrativeEmphasis: string | null;
}

interface SelectedResponseSelection {
  actionId: string;
  variantId: string | null;
  variantLabel: string | null;
  customLabel: string | null;
  interpretationRationale: string | null;
  narrativeEmphasis: string | null;
  source: 'manual' | 'custom';
}

interface SuggestedResponseSelection extends SelectedResponseSelection {
  action: ActionDefinition;
}

const getDefaultVariant = (action: ActionDefinition): ActionVariantDefinition | null => {
  if (!action.variants || action.variants.length === 0) {
    return null;
  }
  return (
    action.variants.find((variant) => variant.id === action.defaultVariantId || variant.isDefault) ??
    action.variants[0] ??
    null
  );
};

const buildManualSelection = (action: ActionDefinition): SelectedResponseSelection => {
  const variant = getDefaultVariant(action);
  return {
    actionId: action.id,
    variantId: variant?.id ?? null,
    variantLabel: variant?.label ?? null,
    customLabel: null,
    interpretationRationale: null,
    narrativeEmphasis: variant?.narrativeEmphasis ?? null,
    source: 'manual'
  };
};

const App = () => {
  const [reference, setReference] = useState<BootstrapPayload | null>(null);
  const [episode, setEpisode] = useState<EpisodeView | null>(null);
  const [report, setReport] = useState<PostGameReport | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [selectedResponse, setSelectedResponse] = useState<SelectedResponseSelection | null>(null);
  const [turnStage, setTurnStage] = useState<TurnStage>('brief');

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
      readsByActionId.set(action.id, getAdvisorActionReads(action, activeAdvisorDossiers, currentBeat));
    }

    return readsByActionId;
  }, [activeAdvisorDossiers, currentBeat, episode?.offeredActions]);
  const selectedAction = episode?.offeredActions.find((action) => action.id === selectedResponse?.actionId) ?? null;
  const selectedVariant = useMemo(() => {
    if (!selectedAction) {
      return null;
    }
    if (selectedResponse?.variantId) {
      return selectedAction.variants?.find((variant) => variant.id === selectedResponse.variantId) ?? getDefaultVariant(selectedAction);
    }
    return getDefaultVariant(selectedAction);
  }, [selectedAction, selectedResponse?.variantId]);
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
    const beatBefore = currentScenario.beats.find((beat) => beat.id === episode.recentTurn?.beatIdBefore);

    if (!action) {
      return null;
    }

    const detail = resolveActionNarrativeDetail(reference.actionNarratives, action.id, beatBefore?.phase);

    if (!detail) {
      return null;
    }

    return {
      actionName:
        episode.recentTurn?.playerActionCustomLabel ??
        episode.recentTurn?.playerActionVariantLabel ??
        action.name,
      phaseLabel: beatBefore?.phase ?? 'crisis',
      detail
    };
  }, [currentScenario, episode?.recentTurn, reference]);
  const selectedActionNarrativePreview = useMemo<ActionNarrativePhaseContent | null>(() => {
    if (!reference || !selectedAction) {
      return null;
    }

    return resolveActionNarrativeDetail(reference.actionNarratives, selectedAction.id, currentBeat?.phase);
  }, [currentBeat?.phase, reference, selectedAction]);
  const recentResolvedAction = useMemo<ResolvedActionOutcomeContext | null>(() => {
    if (!reference || !episode?.recentTurn) {
      return null;
    }

    const action = reference.actions.find((entry) => entry.id === episode.recentTurn?.playerActionId);
    if (!action) {
      return null;
    }

    const variant = episode.recentTurn.playerActionVariantId
      ? action.variants?.find((entry) => entry.id === episode.recentTurn?.playerActionVariantId) ?? null
      : getDefaultVariant(action);

    return {
      label:
        episode.recentTurn.playerActionCustomLabel ??
        episode.recentTurn.playerActionVariantLabel ??
        action.name,
      summary: variant?.summary ?? action.summary,
      hiddenDownsideCategory: variant?.hiddenDownsideCategory ?? null,
      narrativeEmphasis: variant?.narrativeEmphasis ?? null
    };
  }, [episode?.recentTurn, reference]);
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
    setSelectedResponse(null);
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
    if (!episode) {
      return;
    }

    const action = episode.offeredActions.find((entry) => entry.id === actionId);
    if (!action) {
      return;
    }

    setSelectedResponse(buildManualSelection(action));
  }, [episode]);

  const handleCommandSuggestionSelect = useCallback(async (suggestion: CommandSuggestion): Promise<void> => {
    const variant = suggestion.variantId
      ? suggestion.action.variants?.find((entry) => entry.id === suggestion.variantId) ?? null
      : getDefaultVariant(suggestion.action);

    setSelectedResponse({
      actionId: suggestion.action.id,
      variantId: variant?.id ?? suggestion.variantId ?? null,
      variantLabel: variant?.label ?? suggestion.variantLabel ?? null,
      customLabel: suggestion.customLabel ?? null,
      interpretationRationale: suggestion.interpretationRationale ?? null,
      narrativeEmphasis: suggestion.narrativeEmphasis ?? variant?.narrativeEmphasis ?? null,
      source: 'custom'
    });
  }, []);

  const handleActionCommit = async (): Promise<void> => {
    if (!episode) {
      return;
    }
    if (!selectedResponse) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await submitAction(episode.episodeId, {
        expectedTurn: episode.turn,
        actionId: selectedResponse.actionId,
        variantId: selectedResponse.variantId,
        customLabel: selectedResponse.customLabel,
        interpretationRationale: selectedResponse.interpretationRationale
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
    setSelectedResponse((current) => {
      if (!episode || !current) {
        return null;
      }

      const action = episode.offeredActions.find((entry) => entry.id === current.actionId);
      if (!action) {
        return null;
      }

      const variant = current.variantId
        ? action.variants?.find((entry) => entry.id === current.variantId) ?? null
        : getDefaultVariant(action);

      return {
        ...current,
        variantId: variant?.id ?? null,
        variantLabel: variant?.label ?? null,
        narrativeEmphasis: current.narrativeEmphasis ?? variant?.narrativeEmphasis ?? null
      };
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
    setSelectedResponse(null);
    setTurnStage('brief');
    timeoutGuardRef.current = null;
  };

  const handleCommandSubmit = useCallback(async (commandText: string): Promise<CommandSubmitResult> => {
    if (!episode) {
      return {
        message: 'No active scenario detected. Begin a scenario before entering a custom response.'
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
          message: 'Instruction accepted: holding position and taking no action during this decision window.'
        };
      }
      return {
        message: 'Hold instruction recognized, but explicit no-action is only available on untimed decision windows.'
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
        setSelectedResponse(null);
        return {
          message: 'Command target was stale. Synced to the latest decision window.'
        };
      }

      if (interpretation.decision !== 'execute' || !interpretation.interpretedActionId) {
        const suggestionActions: SuggestedResponseSelection[] = interpretation.decision === 'review'
          ? interpretation.suggestions
            .map<SuggestedResponseSelection | null>((suggestion) => {
              const action = episode.offeredActions.find((entry) => entry.id === suggestion.actionId);
              if (!action) {
                return null;
              }

              const variant = suggestion.variantId
                ? action.variants?.find((entry) => entry.id === suggestion.variantId) ?? null
                : getDefaultVariant(action);

              return {
                action,
                actionId: action.id,
                variantId: variant?.id ?? null,
                variantLabel: variant?.label ?? suggestion.variantLabel ?? null,
                customLabel: null,
                interpretationRationale: null,
                narrativeEmphasis: variant?.narrativeEmphasis ?? null,
                source: 'custom' as const
              };
            })
            .filter((entry): entry is SuggestedResponseSelection => Boolean(entry))
          : [];

        return {
          message: interpretation.message,
          decision: interpretation.decision,
          suggestions: suggestionActions
        };
      }

      const interpretedAction = episode.offeredActions.find((action) => action.id === interpretation.interpretedActionId);
      if (interpretedAction) {
        const variant = interpretation.variantId
          ? interpretedAction.variants?.find((entry) => entry.id === interpretation.variantId) ?? null
          : getDefaultVariant(interpretedAction);

        setSelectedResponse({
          actionId: interpretedAction.id,
          variantId: variant?.id ?? interpretation.variantId,
          variantLabel: variant?.label ?? interpretation.variantLabel,
          customLabel: interpretation.customLabel,
          interpretationRationale: interpretation.interpretationRationale,
          narrativeEmphasis: interpretation.narrativeEmphasis ?? variant?.narrativeEmphasis ?? null,
          source: 'custom'
        });
      }

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

  const supportingSignals: IntelFeedEntry[] = [];
  for (const fragment of selectedIntelFragments) {
    supportingSignals.push({
      id: fragment.id,
      channel: `${fragment.sourceType} · ${fragment.confidence.toUpperCase()}`,
      headline: fragment.headline,
      detail: fragment.analystNote ?? fragment.body
    });
  }

  for (const article of selectedNewsArticles) {
    supportingSignals.push({
      id: article.id,
      channel: `${article.outlet} · ${article.tone.toUpperCase()}`,
      headline: article.headline,
      detail: article.lede
    });
  }

  if (pressureText) {
    supportingSignals.push({
      id: 'timer-pressure',
      channel: 'Timer',
      headline: pressureText
    });
  }
  if (supportingSignals.length === 0 && episode.briefing.tickerLine) {
    supportingSignals.push({
      id: 'ticker',
      channel: 'Market',
      headline: normalizeTickerLine(episode.briefing.tickerLine)
    });
  }
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
  const currentDirective =
    episode.briefing.briefingParagraph ??
    currentBeat?.sceneFragments[0] ??
    currentScenario?.briefing ??
    currentScenarioWorld?.economicBackdrop.straitEconomicValue ??
    '';
  const dynamicContextSections = buildDynamicContextSections(
    episode.turn,
    episode.meters,
    episode.recentTurn?.meterBefore
  );
  const activeWindowContextSections = currentBeat?.windowContext?.sections?.length
    ? currentBeat.windowContext.sections
    : dynamicContextSections;
  const activeTruthModel = currentBeat?.truthModel ?? null;
  const whyItMattersSummary =
    activeWindowContextSections[0]?.body ??
    currentBeat?.sceneFragments[0] ??
    currentScenarioWorld?.economicBackdrop.straitEconomicValue ??
    currentDirective ??
    'This development matters because it can change how the crisis is read across the room, the market, and the corridor.';
  const turnResolutionGuidance =
    episode.activeCountdown && remainingSeconds !== null
      ? `Select one response, inspect the tradeoffs, and confirm it before ${formatSeconds(remainingSeconds)} elapses.`
      : showTakeNoAction
        ? 'Select one response and confirm it, or use Take No Action to hold position.'
        : 'Select one response, inspect the detail, and confirm it to advance the scenario.';
  const decisionPromptSummary =
    activeWindowContextSections[1]?.body ??
    turnResolutionGuidance;
  const executiveSummary = [
    {
      label: 'What changed',
      detail:
        activeTruthModel?.verifiedFacts?.[0]?.title ??
        episode.briefing.headlines[0] ??
        episode.briefing.briefingParagraph ??
        'New pressure is entering the scenario, but the full change summary is still loading.'
    },
    {
      label: 'Why it matters',
      detail: whyItMattersSummary
    },
    {
      label: 'Decision required now',
      detail: decisionPromptSummary
    }
  ];
  const summaryLead =
    episode.briefing.headlines[0] ??
    currentBeat?.memoLine ??
    activeTruthModel?.verifiedFacts?.[0]?.title ??
    currentBeat?.sceneFragments[0] ??
    currentDirective;
  const previewImageAssets = episode.imageAsset
    ? []
    : pickPreviewImageAssets(reference, currentScenario, currentBeat, {
        recentImageIds: [
          ...(episode.recentTurn?.selectedImageId ? [episode.recentTurn.selectedImageId] : []),
          ...(episode.recentTurn?.selectedSupportingImageIds ?? [])
        ],
        selectedAction,
        selectedVariant
      });
  const briefingImageAsset = episode.imageAsset ?? previewImageAssets[0] ?? null;
  const briefingSupportingImageAssets = episode.imageAsset
    ? episode.supportingImageAssets
    : previewImageAssets.slice(1);
  const briefingImageCaptionOverride = episode.imageAsset ? null : currentBeat?.visualCue?.caption ?? null;
  const arrangedBriefingVisuals = arrangeBriefingVisuals(briefingImageAsset, briefingSupportingImageAssets);
  const appliedBriefingImageCaptionOverride =
    arrangedBriefingVisuals.heroAsset?.id === briefingImageAsset?.id ? briefingImageCaptionOverride : null;
  const selectedResponseLabel = selectedResponse?.customLabel
    ?? (selectedAction
      ? selectedResponse?.variantLabel
        ? `${selectedAction.name} · ${selectedResponse.variantLabel}`
        : selectedAction.name
      : null);
  const turnStageLabel = turnStage === 'brief' ? 'Situation Summary' : 'Decision';
  const turnStageActionLabel = turnStage === 'brief'
    ? selectedAction
      ? 'Return To Selected Response'
      : 'Proceed To Decision'
    : 'Back To Summary';

  return (
    <main className="mx-auto flex w-full max-w-[1680px] flex-col gap-4 px-3 py-3 pb-8 sm:px-4 lg:px-5">
      <header className="console-topbar px-3 py-3 sm:px-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-1">
            <p className="label">Altira Flashpoint // Live Scenario</p>
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
              <strong>Signal Quality</strong>
              <span>{intelStateLabel}</span>
            </div>
            <div className="console-chip">
              <strong>Current View</strong>
              <span>{turnStageLabel}</span>
            </div>
            <div className="console-chip">
              <strong>Selected</strong>
              <span>{selectedResponseLabel ?? 'Awaiting decision'}</span>
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
              <p className="console-metric-label">Window</p>
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
              <p className="console-metric-label">Response Window</p>
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
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="label text-accent">Situation Summary</p>
                  <span className="action-required-status border-accent/55 bg-accent/10 text-accent">
                    Review Before Deciding
                  </span>
                </div>
                <p className="mt-2 text-[0.8rem] leading-relaxed text-textMain">{summaryLead}</p>
              </div>
              <div className="flex shrink-0 items-start">
                <button
                  type="button"
                  className="console-button console-button-info min-w-[12.5rem]"
                  onClick={() => setTurnStage('decision')}
                  disabled={loading || episode.status !== 'active'}
                >
                  {turnStageActionLabel}
                </button>
              </div>
            </div>
          </section>

          <section className="console-panel console-panel-muted px-3 py-2.5 sm:px-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="label">Executive Summary</p>
              </div>
            </div>
            <div className="mt-2 grid gap-2 lg:grid-cols-3">
              {executiveSummary.map((entry) => (
                <article key={entry.label} className="console-subpanel px-3 py-2.5">
                  <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">{entry.label}</p>
                  <p className="mt-1.5 text-[0.74rem] leading-relaxed text-textMain">{entry.detail}</p>
                </article>
              ))}
            </div>
          </section>

          <BriefingPanel
            turn={episode.turn}
            briefing={episode.briefing}
            scenarioWorld={currentScenarioWorld}
            truthModel={activeTruthModel}
            windowContextSections={activeWindowContextSections}
            imageAsset={arrangedBriefingVisuals.heroAsset}
            supportingImageAssets={arrangedBriefingVisuals.evidenceAssets}
            imageCaptionOverride={appliedBriefingImageCaptionOverride}
            supportingSignals={supportingSignals}
            turnDebrief={episode.turnDebrief}
            recentActionNarrative={recentActionNarrative}
            recentResolvedAction={recentResolvedAction}
            phaseTransition={phaseTransition}
            meters={episode.meters}
            previousMeters={episode.recentTurn?.meterBefore}
            meterHistory={episode.meterHistory}
          />
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
              <p className="mt-2 text-[0.82rem] leading-relaxed text-textMain">{currentDirective}</p>
              <p className="mt-2 text-sm leading-relaxed text-textMain">
                Compare the available responses, inspect advisor reasoning, then confirm a selected response to advance the scenario.
              </p>
              <p className="mt-2 text-[0.72rem] leading-relaxed text-textMuted">
                Need more context first? Return to the Situation Summary to review the full intelligence and mandate surfaces before you confirm.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="action-required-step">
                  <p className="text-[0.56rem] uppercase tracking-[0.12em] text-accent">1. Select</p>
                  <p className="mt-1 text-[0.7rem] leading-relaxed text-textMain">Choose one response from the available list.</p>
                </div>
                <div className="action-required-step">
                  <p className="text-[0.56rem] uppercase tracking-[0.12em] text-accent">2. Consult</p>
                  <p className="mt-1 text-[0.7rem] leading-relaxed text-textMain">Open advisor cards to review the reasoning behind the selected response.</p>
                </div>
                <div className="action-required-step">
                  <p className="text-[0.56rem] uppercase tracking-[0.12em] text-accent">3. Commit</p>
                  <p className="mt-1 text-[0.7rem] leading-relaxed text-textMain">Advance the scenario only after you are satisfied with the selected response.</p>
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
                Back To Summary
              </button>
              <div
                className={`console-chip ${
                  selectedAction ? 'border-positive/45 bg-positive/8' : 'border-accent/50 bg-accent/8'
                }`}
              >
                <strong>Decision</strong>
                <span>{selectedResponseLabel ?? 'Choose a response'}</span>
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
              selectedActionId={selectedResponse?.actionId ?? null}
              selectedVariantId={selectedResponse?.variantId ?? null}
              selectedVariantLabel={selectedResponse?.variantLabel ?? null}
              selectedCustomLabel={selectedResponse?.customLabel ?? null}
              selectedInterpretationRationale={selectedResponse?.interpretationRationale ?? null}
              selectedNarrativeEmphasis={selectedResponse?.narrativeEmphasis ?? selectedVariant?.narrativeEmphasis ?? null}
              selectedActionNarrativePreview={selectedActionNarrativePreview}
              actionAdvisorSummaries={actionAdvisorSummaries}
              customResponseSlot={
                <CommandInput
                  turn={episode.turn}
                  disabled={loading || episode.status !== 'active'}
                  onSubmitCommand={handleCommandSubmit}
                  onSelectAction={handleCommandSuggestionSelect}
                />
              }
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
        </section>
      )}
    </main>
  );
};

export default App;
