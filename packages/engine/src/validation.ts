import type { BeatNode, ScenarioDefinition } from '@wargames/shared-types';

export interface ValidationIssue {
  level: 'error' | 'warning';
  scenarioId: string;
  beatId?: string;
  message: string;
}

export interface BeatGraphAnalysis {
  scenarioId: string;
  startBeatId: string;
  beatCount: number;
  terminalBeatIds: string[];
  reachableBeatIds: string[];
  unreachableBeatIds: string[];
  beatsWithoutTerminalPath: string[];
  issues: ValidationIssue[];
}

const getBeatMap = (scenario: ScenarioDefinition): Map<string, BeatNode> => {
  return new Map(scenario.beats.map((beat) => [beat.id, beat]));
};

const collectReachable = (startBeatId: string, beatMap: Map<string, BeatNode>): Set<string> => {
  const visited = new Set<string>();
  const stack: string[] = [startBeatId];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || visited.has(current)) {
      continue;
    }
    visited.add(current);

    const beat = beatMap.get(current);
    if (!beat) {
      continue;
    }

    for (const branch of beat.branches) {
      if (!visited.has(branch.targetBeatId)) {
        stack.push(branch.targetBeatId);
      }
    }

    if (beat.decisionWindow?.inactionBeatId && !visited.has(beat.decisionWindow.inactionBeatId)) {
      stack.push(beat.decisionWindow.inactionBeatId);
    }
  }

  return visited;
};

const computeTerminalReachability = (beatId: string, beatMap: Map<string, BeatNode>, memo: Map<string, boolean>, active: Set<string>): boolean => {
  if (memo.has(beatId)) {
    return memo.get(beatId) as boolean;
  }
  if (active.has(beatId)) {
    return false;
  }

  const beat = beatMap.get(beatId);
  if (!beat) {
    memo.set(beatId, false);
    return false;
  }

  if (beat.terminalOutcome) {
    memo.set(beatId, true);
    return true;
  }

  active.add(beatId);
  for (const branch of beat.branches) {
    if (computeTerminalReachability(branch.targetBeatId, beatMap, memo, active)) {
      active.delete(beatId);
      memo.set(beatId, true);
      return true;
    }
  }
  if (beat.decisionWindow?.inactionBeatId) {
    if (computeTerminalReachability(beat.decisionWindow.inactionBeatId, beatMap, memo, active)) {
      active.delete(beatId);
      memo.set(beatId, true);
      return true;
    }
  }
  active.delete(beatId);
  memo.set(beatId, false);
  return false;
};

export const analyzeBeatGraph = (scenario: ScenarioDefinition): BeatGraphAnalysis => {
  const issues: ValidationIssue[] = [];
  const beatMap = getBeatMap(scenario);
  const startBeat = beatMap.get(scenario.startingBeatId);

  if (!startBeat) {
    issues.push({
      level: 'error',
      scenarioId: scenario.id,
      message: `Starting beat does not exist: ${scenario.startingBeatId}`
    });
  }

  for (const beat of scenario.beats) {
    if (!beat.terminalOutcome && beat.branches.length === 0) {
      issues.push({
        level: 'error',
        scenarioId: scenario.id,
        beatId: beat.id,
        message: 'Non-terminal beat has no outgoing branches.'
      });
    }

    const hasFallbackBranch = beat.branches.some(
      (branch) =>
        branch.conditions.length === 0 &&
        ((branch.minTurn !== undefined && branch.minTurn !== null) || (branch.maxTurn !== undefined && branch.maxTurn !== null))
    );

    if (!beat.terminalOutcome && !hasFallbackBranch) {
      issues.push({
        level: 'warning',
        scenarioId: scenario.id,
        beatId: beat.id,
        message: 'No explicit fallback branch (empty conditions + turn bound).'
      });
    }

    for (const branch of beat.branches) {
      if (!beatMap.has(branch.targetBeatId)) {
        issues.push({
          level: 'error',
          scenarioId: scenario.id,
          beatId: beat.id,
          message: `Branch target does not exist: ${branch.targetBeatId}`
        });
      }
    }
  }

  const reachable = startBeat ? collectReachable(startBeat.id, beatMap) : new Set<string>();
  const unreachableBeatIds = scenario.beats.map((beat) => beat.id).filter((beatId) => !reachable.has(beatId));
  for (const beatId of unreachableBeatIds) {
    issues.push({
      level: 'error',
      scenarioId: scenario.id,
      beatId,
      message: 'Beat is unreachable from scenario.startingBeatId.'
    });
  }

  const memo = new Map<string, boolean>();
  const beatsWithoutTerminalPath = scenario.beats
    .filter((beat) => reachable.has(beat.id))
    .filter((beat) => !computeTerminalReachability(beat.id, beatMap, memo, new Set<string>()))
    .map((beat) => beat.id);

  for (const beatId of beatsWithoutTerminalPath) {
    issues.push({
      level: 'error',
      scenarioId: scenario.id,
      beatId,
      message: 'Reachable beat has no path to any terminal outcome.'
    });
  }

  const terminalBeatIds = scenario.beats
    .filter((beat) => beat.terminalOutcome !== null)
    .map((beat) => beat.id);

  if (terminalBeatIds.length === 0) {
    issues.push({
      level: 'error',
      scenarioId: scenario.id,
      message: 'Scenario does not define any terminal beat.'
    });
  }

  return {
    scenarioId: scenario.id,
    startBeatId: scenario.startingBeatId,
    beatCount: scenario.beats.length,
    terminalBeatIds,
    reachableBeatIds: [...reachable],
    unreachableBeatIds,
    beatsWithoutTerminalPath,
    issues
  };
};

export const validateBeatGraphs = (scenarios: ScenarioDefinition[]): BeatGraphAnalysis[] => {
  return scenarios.map((scenario) => analyzeBeatGraph(scenario));
};
