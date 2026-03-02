import type {
  ActionDefinition,
  BeatNode,
  BranchCondition,
  GameState,
  MeterState,
  OutcomeCategory,
  ScenarioDefinition
} from '@wargames/shared-types';

import { clamp } from './utils';

export interface BeatTraversalResult {
  beatIdBefore: string;
  beatIdAfter: string;
  transitioned: boolean;
  terminalOutcome: OutcomeCategory | null;
}

export const buildBeatMap = (scenario: ScenarioDefinition): Map<string, BeatNode> => {
  return new Map(scenario.beats.map((beat) => [beat.id, beat]));
};

export const getBeat = (beatMap: Map<string, BeatNode>, beatId: string): BeatNode => {
  const beat = beatMap.get(beatId);
  if (!beat) {
    throw new Error(`Beat not found: ${beatId}`);
  }
  return beat;
};

const readConditionValue = (state: GameState, source: 'meter' | 'latent' | 'belief', key: string): number | null => {
  if (source === 'meter') {
    const meterValue = state.meters[key as keyof MeterState];
    return typeof meterValue === 'number' ? meterValue : null;
  }

  if (source === 'latent') {
    const latentValue = state.latent[key as keyof typeof state.latent];
    return typeof latentValue === 'number' ? latentValue : null;
  }

  const beliefValue = state.beliefs[key as keyof typeof state.beliefs];
  return typeof beliefValue === 'number' ? beliefValue : null;
};

const compare = (left: number, op: BranchCondition['conditions'][number]['op'], right: number): boolean => {
  if (op === 'lt') {
    return left < right;
  }
  if (op === 'lte') {
    return left <= right;
  }
  if (op === 'gt') {
    return left > right;
  }
  if (op === 'gte') {
    return left >= right;
  }
  return left === right;
};

const branchSort = (left: { branch: BranchCondition; index: number }, right: { branch: BranchCondition; index: number }): number => {
  const leftPriority = left.branch.priority ?? 0;
  const rightPriority = right.branch.priority ?? 0;
  if (leftPriority !== rightPriority) {
    return rightPriority - leftPriority;
  }
  return left.index - right.index;
};

const branchMatches = (
  state: GameState,
  branch: BranchCondition,
  playerAction: ActionDefinition
): boolean => {
  if (branch.minTurn !== undefined && branch.minTurn !== null && state.turn < branch.minTurn) {
    return false;
  }
  if (branch.maxTurn !== undefined && branch.maxTurn !== null && state.turn > branch.maxTurn) {
    return false;
  }
  if (branch.requiresActionTag && !playerAction.tags.includes(branch.requiresActionTag)) {
    return false;
  }

  return branch.conditions.every((condition) => {
    const observed = readConditionValue(state, condition.source, condition.key);
    if (observed === null) {
      return false;
    }
    return compare(observed, condition.op, condition.value);
  });
};

export const applyMeterOverrides = (state: GameState, beat: BeatNode): void => {
  if (!beat.meterOverrides) {
    return;
  }

  for (const [key, value] of Object.entries(beat.meterOverrides)) {
    if (typeof value !== 'number') {
      continue;
    }
    const meterKey = key as keyof MeterState;
    state.meters[meterKey] = clamp(value, 0, 100);
  }
};

export const setCountdownForBeat = (state: GameState, beat: BeatNode, nowMs?: number): void => {
  if (!beat.decisionWindow) {
    state.activeCountdown = null;
    return;
  }

  if (state.timerMode === 'off') {
    state.activeCountdown = null;
    return;
  }

  const multiplier = state.timerMode === 'relaxed' ? 1.5 : 1;
  const seconds = Math.round(beat.decisionWindow.seconds * multiplier);
  const now = nowMs ?? Date.now();
  state.activeCountdown = {
    beatId: beat.id,
    seconds,
    secondsRemaining: seconds,
    expiresAt: now + seconds * 1000,
    inactionBeatId: beat.decisionWindow.inactionBeatId,
    inactionDeltas: beat.decisionWindow.inactionDeltas,
    inactionNarrative: beat.decisionWindow.inactionNarrative,
    extendsUsed: 0
  };
};

export const applyBeatEntryEffects = (state: GameState, beat: BeatNode, nowMs?: number): void => {
  if (beat.advisorUnlock && !state.activeAdvisors.includes(beat.advisorUnlock)) {
    state.activeAdvisors.push(beat.advisorUnlock);
  }

  applyMeterOverrides(state, beat);
  setCountdownForBeat(state, beat, nowMs);
};

export const traverseBeatGraph = (
  state: GameState,
  scenario: ScenarioDefinition,
  playerAction: ActionDefinition,
  nowMs?: number
): BeatTraversalResult => {
  const beatMap = buildBeatMap(scenario);
  const currentBeat = getBeat(beatMap, state.currentBeatId);
  const orderedBranches = currentBeat.branches
    .map((branch, index) => ({ branch, index }))
    .sort(branchSort);

  let targetBeatId = currentBeat.id;
  for (const { branch } of orderedBranches) {
    if (branchMatches(state, branch, playerAction)) {
      targetBeatId = branch.targetBeatId;
      break;
    }
  }

  const transitioned = targetBeatId !== currentBeat.id;
  if (!transitioned) {
    return {
      beatIdBefore: currentBeat.id,
      beatIdAfter: currentBeat.id,
      transitioned: false,
      terminalOutcome: currentBeat.terminalOutcome
    };
  }

  const targetBeat = getBeat(beatMap, targetBeatId);
  state.currentBeatId = targetBeat.id;
  state.beatHistory.push(targetBeat.id);
  applyBeatEntryEffects(state, targetBeat, nowMs);

  return {
    beatIdBefore: currentBeat.id,
    beatIdAfter: targetBeat.id,
    transitioned: true,
    terminalOutcome: targetBeat.terminalOutcome
  };
};
