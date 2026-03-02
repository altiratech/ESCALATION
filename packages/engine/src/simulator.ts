import type {
  ActionDefinition,
  ActiveCountdown,
  BeatNode,
  GameState,
  ImageAsset,
  RivalArchetype,
  ScenarioDefinition,
  TurnDebrief,
  TimerMode,
  TurnResolution
} from '@wargames/shared-types';

import { selectPlayerActionOptions } from './actionSelection';
import { applyBeatEntryEffects, buildBeatMap, getBeat, traverseBeatGraph } from './beatTraversal';
import { updateBeliefs } from './beliefs';
import { buildTurnDebrief } from './debrief';
import { applyActionToState, applyDueDelayedEffects } from './effects';
import { triggerEvents } from './events';
import { chooseImageAsset } from './images';
import { degradeIntelQuality, projectVisibleRanges } from './intel';
import { buildNarrativeBundle, buildOpeningNarrative, buildOpeningNarrativeFromBeat } from './narrative';
import { evaluateOutcome, isCatastrophicTermination } from './outcome';
import { SeededRng } from './rng';
import { chooseRivalAction } from './rival';
import { clamp, deepClone } from './utils';

export interface EngineContext {
  scenario: ScenarioDefinition;
  archetype: RivalArchetype;
  actions: ActionDefinition[];
  images: ImageAsset[];
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
  now = Date.now()
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

  const baseState: GameState = {
    id: episodeId,
    scenarioId: context.scenario.id,
    rivalArchetypeId: context.archetype.id,
    turn: 1,
    maxTurns: context.scenario.maxTurns,
    status: 'active',
    meters: deepClone(context.scenario.initialMeters),
    latent: deepClone(context.scenario.initialLatent),
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

const meterDisplayNames: Record<keyof GameState['meters'], string> = {
  economicStability: 'market stability',
  energySecurity: 'energy security',
  domesticCohesion: 'domestic cohesion',
  militaryReadiness: 'force readiness',
  allianceTrust: 'alliance trust',
  escalationIndex: 'escalation pressure'
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
  const playerLine =
    payload.source === 'timeout'
      ? 'No directive was issued before the decision window expired.'
      : 'You deliberately selected Take No Action during the decision window.';
  const shift = strongestShift(payload.meterBefore, payload.meterAfter);
  const secondaryLine = shift
    ? `Secondary effect: ${meterDisplayNames[shift.key]} ${shift.delta > 0 ? 'rose' : 'fell'} ${Math.abs(Math.round(shift.delta))} points after the no-action branch triggered.`
    : 'Secondary effect: the no-action branch shifted strategic tempo without a single dominant meter move.';

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

export const extendActiveCountdown = (currentState: GameState, now = Date.now()): GameState => {
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
  const now = options.now ?? Date.now();
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

  const selectedImage = chooseImageAsset(
    context.images,
    context.scenario,
    state.meters,
    turnDelta,
    state.recentImageIds,
    rng
  );

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
    rngTrace: [...rng.trace]
  };

  state.history.push(historyEntry);
  state.turnDebrief = turnDebrief;
  state.recentImageIds = selectedImage ? [...state.recentImageIds, selectedImage.id].slice(-6) : state.recentImageIds;

  const reachedTurnLimit = state.turn >= state.maxTurns;
  const catastrophic = isCatastrophicTermination(state);
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
  nowMs?: number
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

  const state = deepClone(currentState);
  const rng = new SeededRng(state.rngState);
  const pressureMultiplier = pressureForTurn(context.scenario, state.turn);
  const beatIdBefore = state.currentBeatId;
  const meterBefore = deepClone(state.meters);
  state.activeCountdown = null;

  const playerResult = applyActionToState(state, playerAction, 'player', rng, pressureMultiplier);
  const delayedDescriptions = applyDueDelayedEffects(state, rng, pressureMultiplier);
  const preRivalEvents = triggerEvents(state, context.scenario.eventTable, rng, pressureMultiplier);

  const beliefsAfter = updateBeliefs(state.beliefs, playerAction, state, context.archetype, rng);
  state.beliefs = beliefsAfter;

  const rivalAction = chooseRivalAction(state, context.scenario, context.archetype, beliefsAfter, actionMap, rng);
  const rivalResult = applyActionToState(state, rivalAction, 'rival', rng, pressureMultiplier);

  const postRivalEvents = triggerEvents(state, context.scenario.eventTable, rng, pressureMultiplier);

  const traversal = traverseBeatGraph(state, context.scenario, playerAction, nowMs);
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

  const selectedImage = chooseImageAsset(
    context.images,
    context.scenario,
    state.meters,
    turnDelta,
    state.recentImageIds,
    rng
  );

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
    context.archetype,
    postTraversalBeat
  );

  const turnDebrief = buildTurnDebrief({
    playerAction,
    rivalAction,
    meterBefore,
    meterAfter: state.meters,
    narrativeTokens: allNarrativeTokens,
    triggeredEventIds: [...preRivalEvents.map((entry) => entry.id), ...postRivalEvents.map((entry) => entry.id)],
    eventTable: context.scenario.eventTable
  });

  const historyEntry = {
    turn: state.turn,
    beatIdBefore,
    beatIdAfter: traversal.beatIdAfter,
    offeredActionIds: [...state.offeredActionIds],
    playerActionId,
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
    rngTrace: [...rng.trace]
  };

  state.history.push(historyEntry);
  state.turnDebrief = turnDebrief;
  state.recentImageIds = selectedImage ? [...state.recentImageIds, selectedImage.id].slice(-6) : state.recentImageIds;

  const reachedTurnLimit = state.turn >= state.maxTurns;
  const catastrophic = isCatastrophicTermination(state);
  const ended = reachedTurnLimit || catastrophic || traversal.terminalOutcome !== null;

  if (ended) {
    state.status = 'completed';
    state.offeredActionIds = [];
    state.activeCountdown = null;
    state.outcome = traversal.terminalOutcome ?? evaluateOutcome(state);
  } else {
    state.turn += 1;
    // Only build a fresh countdown if the beat actually changed.
    // Same-beat actions consume the existing decision window without resetting the timer,
    // preserving cumulative time pressure within a multi-turn timed beat.
    if (traversal.beatIdBefore !== traversal.beatIdAfter) {
      state.activeCountdown = buildCountdownForBeat(postTraversalBeat, state.timerMode, nowMs);
    }
    state.offeredActionIds = selectPlayerActionOptions(state, context.scenario, actionMap, rng);
  }

  state.rngState = rng.getState();

  const resolution: TurnResolution = {
    turn: historyEntry.turn,
    beatIdBefore: historyEntry.beatIdBefore,
    beatIdAfter: historyEntry.beatIdAfter,
    playerActionId,
    rivalActionId: rivalAction.id,
    triggeredEvents: historyEntry.triggeredEvents,
    selectedImageId: historyEntry.selectedImageId,
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
