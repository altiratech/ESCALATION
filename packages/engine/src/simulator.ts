import type {
  ActionDefinition,
  ActiveCountdown,
  ActionVariantDefinition,
  BeatNode,
  DebriefVariantCandidate,
  GameState,
  ImageAsset,
  AdversaryProfile,
  ScenarioDefinition,
  TurnDebrief,
  TimerMode,
  TurnResolution
} from '@wargames/shared-types';

import { selectPlayerActionOptions } from './actionSelection';
import { applyBeatEntryEffects, buildBeatMap, getBeat, traverseBeatGraph } from './beatTraversal';
import { updateBeliefs } from './beliefs';
import { buildTurnDebrief } from './debrief';
import { applyActionToState, applyDueDelayedEffects, getActionVariant } from './effects';
import { triggerEvents } from './events';
import { chooseImageGallery } from './images';
import { degradeIntelQuality, projectVisibleRanges } from './intel';
import { buildNarrativeBundle, buildOpeningNarrative, buildOpeningNarrativeFromBeat } from './narrative';
import { evaluateOutcome, isCatastrophicTermination } from './outcome';
import { SeededRng } from './rng';
import { chooseRivalAction } from './rival';
import { clamp, deepClone } from './utils';

export interface EngineContext {
  scenario: ScenarioDefinition;
  adversaryProfile: AdversaryProfile;
  actions: ActionDefinition[];
  images: ImageAsset[];
  debriefVariants?: DebriefVariantCandidate[];
}

export interface InitializeOptions {
  timerMode?: TimerMode;
  nowMs?: number;
}

export const buildActionMap = (actions: ActionDefinition[]): Map<string, ActionDefinition> => {
  return new Map(actions.map((action) => [action.id, action]));
};

const buildCountdownForBeat = (
  beat: BeatNode,
  timerMode: TimerMode,
  now = 0
): ActiveCountdown | null => {
  if (!beat.decisionWindow || timerMode === 'off') {
    return null;
  }

  const seconds = Math.round(beat.decisionWindow.seconds * (timerMode === 'relaxed' ? 1.5 : 1));
  return {
    beatId: beat.id,
    seconds,
    secondsRemaining: seconds,
    expiresAt: now + (seconds * 1000),
    inactionBeatId: beat.decisionWindow.inactionBeatId,
    inactionDeltas: beat.decisionWindow.inactionDeltas,
    inactionNarrative: beat.decisionWindow.inactionNarrative,
    extendsUsed: 0
  };
};

export const initializeGameState = (
  episodeId: string,
  seed: string,
  context: EngineContext,
  options: InitializeOptions = {}
): GameState => {
  const rng = new SeededRng(seed);
  const actionMap = buildActionMap(context.actions);
  const beatMap = buildBeatMap(context.scenario);
  const openingBeat = getBeat(beatMap, context.scenario.startingBeatId);
  const timedBeatCount = context.scenario.beats.filter((beat) => beat.decisionWindow !== null).length;
  const timerMode = options.timerMode ?? 'standard';
  const extendTimerUsesRemaining = timerMode === 'off' ? 0 : Math.max(2, timedBeatCount);

  const openingCountdown = buildCountdownForBeat(openingBeat, timerMode, options.nowMs);
  const defaultLatentState: GameState['latent'] = {
    globalLegitimacy: 50,
    rivalDomesticPressure: 50,
    playerDomesticApproval: 50,
    usSurgeSlack: 62,
    munitionsDepth: 58,
    politicalBuffer: 54,
    taiwanResilience: 68,
    shippingStress: 36,
    cyberPrepositioning: 48,
    deceptionEffectiveness: 52,
    vulnerabilityFlags: []
  };
  const initialLatent = {
    ...defaultLatentState,
    ...deepClone(context.scenario.initialLatent)
  };

  const baseState: GameState = {
    schemaVersion: 1,
    id: episodeId,
    scenarioId: context.scenario.id,
    turn: 1,
    maxTurns: context.scenario.maxTurns,
    status: 'active',
    meters: deepClone(context.scenario.initialMeters),
    latent: initialLatent,
    beliefs: deepClone(context.scenario.initialBeliefs),
    intelQuality: {
      byMeter: deepClone(context.scenario.initialIntelQuality),
      expiresAtTurn: null
    },
    delayedQueue: [],
    offeredActionIds: [],
    recentImageIds: [],
    currentBeatId: context.scenario.startingBeatId,
    beatHistory: [context.scenario.startingBeatId],
    activeAdvisors: ['cross', 'chen', 'okonkwo'],
    scenarioRole: context.scenario.role,
    meterLabels: deepClone(context.scenario.meterLabels),
    timerMode,
    extendTimerUsesRemaining,
    activeCountdown: openingCountdown,
    turnDebrief: null,
    history: [],
    seed,
    rngState: rng.getState(),
    outcome: null,
    openingBriefing:
      openingBeat.sceneFragments.length > 0
        ? buildOpeningNarrativeFromBeat(context.scenario.briefing, openingBeat)
        : buildOpeningNarrative(context.scenario.briefing)
  };

  baseState.offeredActionIds = selectPlayerActionOptions(baseState, context.scenario, actionMap, rng);
  baseState.rngState = rng.getState();
  return baseState;
};

const pressureForTurn = (scenario: ScenarioDefinition, turn: number): number => {
  return scenario.pressureCurve[turn - 1] ?? scenario.pressureCurve[scenario.pressureCurve.length - 1] ?? 1;
};

const applyMeterDeltas = (state: GameState, deltas: Partial<GameState['meters']>): void => {
  for (const [key, delta] of Object.entries(deltas)) {
    if (typeof delta !== 'number') {
      continue;
    }
    const meterKey = key as keyof GameState['meters'];
    state.meters[meterKey] = clamp(state.meters[meterKey] + delta, 0, 100);
  }
};

const strongestShift = (meterBefore: GameState['meters'], meterAfter: GameState['meters']): { key: keyof GameState['meters']; delta: number } | null => {
  const ranked = (Object.keys(meterBefore) as Array<keyof GameState['meters']>)
    .map((key) => ({
      key,
      delta: meterAfter[key] - meterBefore[key]
    }))
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta));

  const top = ranked[0];
  if (!top || Math.abs(top.delta) < 1) {
    return null;
  }

  return top;
};

const buildInactionDebrief = (payload: {
  source: 'timeout' | 'explicit';
  meterBefore: GameState['meters'];
  meterAfter: GameState['meters'];
  inactionNarrative: string;
}): TurnDebrief => {
  const inactionShiftRead = (key: keyof GameState['meters'], delta: number): string => {
    if (key === 'economicStability') {
      return delta < 0
        ? 'Secondary effect: carriers, brokers, and lenders took the silence as a sign that the lane might be left to fend for itself.'
        : 'Secondary effect: the commercial picture steadied for the moment, mostly because nothing new forced firms to make a worse assumption.'
    }
    if (key === 'energySecurity') {
      return delta < 0
        ? 'Secondary effect: fuel and logistics desks widened their contingency planning as the window closed without a visible response.'
        : 'Secondary effect: energy desks got a little breathing room, even if nobody trusted it to last.'
    }
    if (key === 'domesticCohesion') {
      return delta < 0
        ? 'Secondary effect: aides started preparing for anger at home because silence in a crisis rarely stays invisible for long.'
        : 'Secondary effect: the public picture held together for one more cycle, which mattered more than it looked.'
    }
    if (key === 'militaryReadiness') {
      return delta < 0
        ? 'Secondary effect: commanders lost usable slack while waiting for guidance that never came.'
        : 'Secondary effect: operators gained a little room to reset the force posture before the next move.'
    }
    if (key === 'allianceTrust') {
      return delta < 0
        ? 'Secondary effect: allied capitals started filling the silence with their own assumptions, which is how a coalition begins to drift.'
        : 'Secondary effect: partners took the pause as discipline rather than paralysis, at least for the moment.'
    }
    return delta > 0
      ? 'Secondary effect: the tempo eased briefly after the window closed without a directive.'
      : 'Secondary effect: the room came out of the silence more alarmed than before.';
  };

  const playerLine =
    payload.source === 'timeout'
      ? 'No directive was issued before the decision window expired.'
      : 'You deliberately held position during the decision window.';
  const shift = strongestShift(payload.meterBefore, payload.meterAfter);
  const secondaryLine = shift
    ? inactionShiftRead(shift.key, shift.delta)
    : 'Secondary effect: the silence changed the pace of the crisis even without one dominant visible effect.';

  return {
    lines: [
      { tag: 'PlayerAction', text: playerLine },
      { tag: 'SecondaryEffect', text: secondaryLine },
      { tag: 'SystemEvent', text: payload.inactionNarrative }
    ]
  };
};

const buildInactionNarrative = (targetBeat: BeatNode, inactionNarrative: string): TurnResolution['narrative'] => {
  const lead = targetBeat.sceneFragments[0] ?? '';
  const narrative: TurnResolution['narrative'] = {
    briefingParagraph: `${inactionNarrative} ${lead}`.replace(/\s+/g, ' ').trim(),
    headlines: targetBeat.headlines.slice(0, 2)
  };

  if (targetBeat.memoLine !== null) {
    narrative.memoLine = targetBeat.memoLine;
  }
  if (targetBeat.tickerLine !== null) {
    narrative.tickerLine = targetBeat.tickerLine;
  }

  return narrative;
};

export interface ResolveInactionOptions {
  source: 'timeout' | 'explicit';
  now?: number;
}

export interface ResolveTurnOptions {
  nowMs?: number;
  playerVariantId?: string | null;
  playerActionCustomLabel?: string | null;
  playerActionInterpretationRationale?: string | null;
}

export const extendActiveCountdown = (
  currentState: GameState,
  now = 0
): GameState => {
  if (currentState.status !== 'active') {
    throw new Error('Episode is already complete.');
  }

  const state = deepClone(currentState);
  const countdown = state.activeCountdown;

  if (!countdown) {
    throw new Error('No active countdown to extend.');
  }
  if (state.timerMode === 'off') {
    throw new Error('Timer extension is unavailable when timer mode is off.');
  }
  if (countdown.beatId !== state.currentBeatId) {
    throw new Error('Countdown is not aligned to the active beat.');
  }
  if (state.extendTimerUsesRemaining <= 0) {
    throw new Error('No episode-level timer extensions remaining.');
  }
  if (countdown.extendsUsed >= 1) {
    throw new Error('This beat already used its timer extension.');
  }

  const remaining = Math.max(0, Math.ceil((countdown.expiresAt - now) / 1000));
  if (remaining <= 0) {
    throw new Error('Countdown already expired.');
  }

  const extensionSeconds = Math.max(1, Math.round(countdown.seconds * 0.5));
  countdown.seconds += extensionSeconds;
  countdown.secondsRemaining = remaining + extensionSeconds;
  countdown.expiresAt += extensionSeconds * 1000;
  countdown.extendsUsed += 1;
  state.extendTimerUsesRemaining -= 1;

  return state;
};

export const resolveInactionTurn = (
  currentState: GameState,
  context: EngineContext,
  options: ResolveInactionOptions
): { nextState: GameState; resolution: TurnResolution } => {
  if (currentState.status !== 'active') {
    throw new Error('Episode is already complete.');
  }

  const state = deepClone(currentState);
  const now = options.now ?? currentState.activeCountdown?.expiresAt ?? 0;
  const beatMap = buildBeatMap(context.scenario);
  const activeBeat = getBeat(beatMap, state.currentBeatId);
  const decisionWindow = activeBeat.decisionWindow;

  if (!decisionWindow) {
    throw new Error('Current beat does not support a no-action branch.');
  }
  if (options.source === 'timeout') {
    if (!state.activeCountdown) {
      throw new Error('No active countdown for timeout resolution.');
    }
    if (now < state.activeCountdown.expiresAt) {
      throw new Error('Countdown has not expired yet.');
    }
  }

  const actionMap = buildActionMap(context.actions);
  const rng = new SeededRng(state.rngState);
  const beatIdBefore = state.currentBeatId;
  const meterBefore = deepClone(state.meters);

  state.activeCountdown = null;
  applyMeterDeltas(state, decisionWindow.inactionDeltas);

  const targetBeat = getBeat(beatMap, decisionWindow.inactionBeatId);
  state.currentBeatId = targetBeat.id;
  state.beatHistory.push(targetBeat.id);
  applyBeatEntryEffects(state, targetBeat, now);

  degradeIntelQuality(state);
  const visibleRanges = projectVisibleRanges(state, rng);

  const turnDelta = {
    economicStability: state.meters.economicStability - meterBefore.economicStability,
    energySecurity: state.meters.energySecurity - meterBefore.energySecurity,
    domesticCohesion: state.meters.domesticCohesion - meterBefore.domesticCohesion,
    militaryReadiness: state.meters.militaryReadiness - meterBefore.militaryReadiness,
    allianceTrust: state.meters.allianceTrust - meterBefore.allianceTrust,
    escalationIndex: state.meters.escalationIndex - meterBefore.escalationIndex
  };

  const selectedImages = chooseImageGallery({
    assets: context.images,
    scenario: context.scenario,
    beat: targetBeat,
    meters: state.meters,
    turnDelta,
    recentImageIds: state.recentImageIds,
    rng
  });
  const selectedImage = selectedImages[0] ?? null;
  const selectedSupportingImageIds = selectedImages.slice(1).map((asset) => asset.id);

  const narrative = buildInactionNarrative(targetBeat, decisionWindow.inactionNarrative);
  const turnDebrief = buildInactionDebrief({
    source: options.source,
    meterBefore,
    meterAfter: state.meters,
    inactionNarrative: decisionWindow.inactionNarrative
  });

  const historyEntry = {
    turn: state.turn,
    beatIdBefore,
    beatIdAfter: targetBeat.id,
    offeredActionIds: [...state.offeredActionIds],
    playerActionId: '__no_action__',
    rivalActionId: '__none__',
    meterBefore,
    meterAfter: deepClone(state.meters),
    visibleRanges,
    triggeredEvents: [],
    beliefSnapshot: deepClone(state.beliefs),
    narrative,
    turnDebrief,
    selectedImageId: selectedImage?.id ?? null,
    selectedSupportingImageIds,
    rngTrace: [...rng.trace]
  };

  state.history.push(historyEntry);
  state.turnDebrief = turnDebrief;
  state.recentImageIds = selectedImages.length > 0
    ? [...state.recentImageIds, ...selectedImages.map((asset) => asset.id)].slice(-9)
    : state.recentImageIds;

  const reachedTurnLimit = state.turn >= state.maxTurns;
  const catastrophic = context.scenario.autoTerminateCatastrophicOutcomes !== false
    ? isCatastrophicTermination(state)
    : false;
  const ended = reachedTurnLimit || catastrophic || targetBeat.terminalOutcome !== null;

  if (ended) {
    state.status = 'completed';
    state.offeredActionIds = [];
    state.activeCountdown = null;
    state.outcome = targetBeat.terminalOutcome ?? evaluateOutcome(state);
  } else {
    state.turn += 1;
    state.activeCountdown = buildCountdownForBeat(targetBeat, state.timerMode, now);
    state.offeredActionIds = selectPlayerActionOptions(state, context.scenario, actionMap, rng);
  }

  state.rngState = rng.getState();

  const resolution: TurnResolution = {
    turn: historyEntry.turn,
    beatIdBefore: historyEntry.beatIdBefore,
    beatIdAfter: historyEntry.beatIdAfter,
    playerActionId: historyEntry.playerActionId,
    rivalActionId: historyEntry.rivalActionId,
    triggeredEvents: historyEntry.triggeredEvents,
    selectedImageId: historyEntry.selectedImageId,
    selectedSupportingImageIds: historyEntry.selectedSupportingImageIds,
    narrative,
    turnDebrief,
    visibleRanges,
    meterBefore,
    meterAfter: deepClone(state.meters),
    beliefsAfter: deepClone(state.beliefs),
    offeredActionIdsNext: [...state.offeredActionIds],
    ended,
    outcome: state.outcome,
    rngTrace: [...rng.trace]
  };

  return {
    nextState: state,
    resolution
  };
};

export const resolveTurn = (
  currentState: GameState,
  playerActionId: string,
  context: EngineContext,
  nowOrOptions?: number | ResolveTurnOptions
): { nextState: GameState; resolution: TurnResolution } => {
  if (currentState.status !== 'active') {
    throw new Error('Episode is already complete.');
  }

  const actionMap = buildActionMap(context.actions);
  const playerAction = actionMap.get(playerActionId);

  if (!playerAction || playerAction.actor !== 'player') {
    throw new Error(`Invalid player action: ${playerActionId}`);
  }

  if (!currentState.offeredActionIds.includes(playerActionId)) {
    throw new Error('Selected action is not available this turn.');
  }

  const options: ResolveTurnOptions = typeof nowOrOptions === 'number' ? { nowMs: nowOrOptions } : nowOrOptions ?? {};
  const playerVariant = getActionVariant(playerAction, options.playerVariantId);

  const state = deepClone(currentState);
  const rng = new SeededRng(state.rngState);
  const pressureMultiplier = pressureForTurn(context.scenario, state.turn);
  const beatIdBefore = state.currentBeatId;
  const meterBefore = deepClone(state.meters);
  const previousCountdown = state.activeCountdown ? deepClone(state.activeCountdown) : null;
  state.activeCountdown = null;

  const playerResult = applyActionToState(state, playerAction, 'player', rng, pressureMultiplier, playerVariant?.id);
  const delayedDescriptions = applyDueDelayedEffects(state, rng, pressureMultiplier);
  const preRivalEvents = triggerEvents(state, context.scenario.eventTable, rng, pressureMultiplier);

  const beliefsAfter = updateBeliefs(state.beliefs, playerAction, state, context.adversaryProfile, rng);
  state.beliefs = beliefsAfter;

  const rivalAction = chooseRivalAction(state, context.scenario, context.adversaryProfile, beliefsAfter, actionMap, rng);
  const rivalResult = applyActionToState(state, rivalAction, 'rival', rng, pressureMultiplier);

  const postRivalEvents = triggerEvents(state, context.scenario.eventTable, rng, pressureMultiplier);

  const traversal = traverseBeatGraph(state, context.scenario, playerAction, options.nowMs);
  const beatMap = buildBeatMap(context.scenario);
  const postTraversalBeat = getBeat(beatMap, state.currentBeatId);

  degradeIntelQuality(state);
  const visibleRanges = projectVisibleRanges(state, rng);

  const turnDelta = {
    economicStability: state.meters.economicStability - meterBefore.economicStability,
    energySecurity: state.meters.energySecurity - meterBefore.energySecurity,
    domesticCohesion: state.meters.domesticCohesion - meterBefore.domesticCohesion,
    militaryReadiness: state.meters.militaryReadiness - meterBefore.militaryReadiness,
    allianceTrust: state.meters.allianceTrust - meterBefore.allianceTrust,
    escalationIndex: state.meters.escalationIndex - meterBefore.escalationIndex
  };

  const beatAfter = getBeat(beatMap, traversal.beatIdAfter);
  const selectedImages = chooseImageGallery({
    assets: context.images,
    scenario: context.scenario,
    beat: beatAfter,
    meters: state.meters,
    turnDelta,
    recentImageIds: state.recentImageIds,
    rng,
    playerAction,
    playerVariant
  });
  const selectedImage = selectedImages[0] ?? null;
  const selectedSupportingImageIds = selectedImages.slice(1).map((asset) => asset.id);

  const allNarrativeTokens = [
    ...playerResult.triggeredSideEffects,
    ...rivalResult.triggeredSideEffects,
    ...preRivalEvents.map((entry) => entry.token),
    ...postRivalEvents.map((entry) => entry.token)
  ];

  const narrative = buildNarrativeBundle(
    state.turn,
    playerAction,
    rivalAction,
    state,
    meterBefore,
    state.meters,
    allNarrativeTokens,
    postTraversalBeat,
    {
      playerVariant,
      playerCustomLabel: options.playerActionCustomLabel ?? null
    }
  );

  const turnDebriefPayload = {
    playerAction,
    rivalAction,
    meterBefore,
    meterAfter: state.meters,
    turn: state.turn,
    phase: postTraversalBeat.phase,
    rivalNarrativeTokens: rivalResult.triggeredSideEffects,
    narrativeTokens: allNarrativeTokens,
    triggeredEventIds: [...preRivalEvents.map((entry) => entry.id), ...postRivalEvents.map((entry) => entry.id)],
    eventTable: context.scenario.eventTable
  };
  const turnDebrief = buildTurnDebrief(
    context.debriefVariants
      ? { ...turnDebriefPayload, debriefVariants: context.debriefVariants }
      : turnDebriefPayload
  );

  const historyEntry = {
    turn: state.turn,
    beatIdBefore,
    beatIdAfter: traversal.beatIdAfter,
    offeredActionIds: [...state.offeredActionIds],
    playerActionId,
    playerActionVariantId: playerVariant?.id ?? null,
    playerActionVariantLabel: playerVariant?.label ?? null,
    playerActionCustomLabel: options.playerActionCustomLabel ?? null,
    rivalActionId: rivalAction.id,
    meterBefore,
    meterAfter: deepClone(state.meters),
    visibleRanges,
    triggeredEvents: [
      ...preRivalEvents.map((entry) => entry.id),
      ...postRivalEvents.map((entry) => entry.id),
      ...delayedDescriptions
    ],
    beliefSnapshot: deepClone(state.beliefs),
    narrative,
    turnDebrief,
    selectedImageId: selectedImage?.id ?? null,
    selectedSupportingImageIds,
    rngTrace: [...rng.trace]
  };

  state.history.push(historyEntry);
  state.turnDebrief = turnDebrief;
  state.recentImageIds = selectedImages.length > 0
    ? [...state.recentImageIds, ...selectedImages.map((asset) => asset.id)].slice(-9)
    : state.recentImageIds;

  const reachedTurnLimit = state.turn >= state.maxTurns;
  const catastrophic = context.scenario.autoTerminateCatastrophicOutcomes !== false
    ? isCatastrophicTermination(state)
    : false;
  const ended = reachedTurnLimit || catastrophic || traversal.terminalOutcome !== null;

  if (ended) {
    state.status = 'completed';
    state.offeredActionIds = [];
    state.activeCountdown = null;
    state.outcome = traversal.terminalOutcome ?? evaluateOutcome(state);
  } else {
    state.turn += 1;
    if (traversal.beatIdBefore !== traversal.beatIdAfter) {
      // traverseBeatGraph applies beat-entry effects (including countdown init) on transition.
      // Keep a defensive fallback for malformed legacy state.
      if (!state.activeCountdown && postTraversalBeat.decisionWindow && state.timerMode !== 'off') {
        state.activeCountdown = buildCountdownForBeat(postTraversalBeat, state.timerMode, options.nowMs ?? 0);
      }
    } else if (previousCountdown && previousCountdown.beatId === state.currentBeatId && state.timerMode !== 'off') {
      // Preserve remaining time pressure on same-beat turns.
      state.activeCountdown = previousCountdown;
    } else {
      state.activeCountdown = buildCountdownForBeat(postTraversalBeat, state.timerMode, options.nowMs ?? 0);
    }
    state.offeredActionIds = selectPlayerActionOptions(state, context.scenario, actionMap, rng);
  }

  state.rngState = rng.getState();

  const resolution: TurnResolution = {
    turn: historyEntry.turn,
    beatIdBefore: historyEntry.beatIdBefore,
    beatIdAfter: historyEntry.beatIdAfter,
    playerActionId,
    playerActionVariantId: historyEntry.playerActionVariantId ?? null,
    playerActionVariantLabel: historyEntry.playerActionVariantLabel ?? null,
    playerActionCustomLabel: historyEntry.playerActionCustomLabel ?? null,
    rivalActionId: rivalAction.id,
    triggeredEvents: historyEntry.triggeredEvents,
    selectedImageId: historyEntry.selectedImageId,
    selectedSupportingImageIds: historyEntry.selectedSupportingImageIds,
    narrative,
    turnDebrief,
    visibleRanges,
    meterBefore,
    meterAfter: deepClone(state.meters),
    beliefsAfter,
    offeredActionIdsNext: [...state.offeredActionIds],
    ended,
    outcome: state.outcome,
    rngTrace: [...rng.trace]
  };

  return {
    nextState: state,
    resolution
  };
};
