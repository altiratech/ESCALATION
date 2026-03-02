import type {
  ActionDefinition,
  GameState,
  MeterState,
  PostGameReport,
  ReportTimelinePoint,
  TurnHistoryEntry
} from '@wargames/shared-types';

import { describeOutcome, evaluateOutcome } from './outcome';

const stressScore = (meters: MeterState): number => {
  return (
    (100 - meters.economicStability) * 0.22 +
    (100 - meters.energySecurity) * 0.14 +
    (100 - meters.domesticCohesion) * 0.2 +
    (100 - meters.allianceTrust) * 0.2 +
    meters.escalationIndex * 0.24
  );
};

const getTimeline = (state: GameState): ReportTimelinePoint[] => {
  return state.history.map((entry) => ({
    turn: entry.turn,
    escalationIndex: entry.meterAfter.escalationIndex,
    allianceTrust: entry.meterAfter.allianceTrust,
    economicStability: entry.meterAfter.economicStability
  }));
};

const findPivotalTurn = (history: TurnHistoryEntry[]): TurnHistoryEntry => {
  if (history.length === 0) {
    throw new Error('Cannot build report without history');
  }

  const ranked = [...history].sort((left, right) => {
    const leftImpact = Math.abs(stressScore(left.meterAfter) - stressScore(left.meterBefore));
    const rightImpact = Math.abs(stressScore(right.meterAfter) - stressScore(right.meterBefore));
    return rightImpact - leftImpact;
  });

  return ranked[0] as TurnHistoryEntry;
};

const pickAlternative = (
  pivotal: TurnHistoryEntry,
  actionMap: Map<string, ActionDefinition>
): { actionId: string; predictedImpact: string } => {
  const candidates = pivotal.offeredActionIds.filter((actionId) => actionId !== pivotal.playerActionId);
  if (candidates.length === 0) {
    return {
      actionId: pivotal.playerActionId,
      predictedImpact: 'No materially different alternative was available in the decision window.'
    };
  }

  const evaluated = candidates
    .map((actionId) => actionMap.get(actionId))
    .filter((action): action is ActionDefinition => Boolean(action))
    .map((action) => {
      const projected = {
        ...pivotal.meterBefore,
        economicStability: pivotal.meterBefore.economicStability + (action.immediateMeterDeltas.economicStability ?? 0),
        energySecurity: pivotal.meterBefore.energySecurity + (action.immediateMeterDeltas.energySecurity ?? 0),
        domesticCohesion: pivotal.meterBefore.domesticCohesion + (action.immediateMeterDeltas.domesticCohesion ?? 0),
        militaryReadiness: pivotal.meterBefore.militaryReadiness + (action.immediateMeterDeltas.militaryReadiness ?? 0),
        allianceTrust: pivotal.meterBefore.allianceTrust + (action.immediateMeterDeltas.allianceTrust ?? 0),
        escalationIndex: pivotal.meterBefore.escalationIndex + (action.immediateMeterDeltas.escalationIndex ?? 0)
      };

      return {
        actionId: action.id,
        score: stressScore(projected)
      };
    })
    .sort((left, right) => left.score - right.score);

  const best = evaluated[0];
  if (!best) {
    return {
      actionId: candidates[0] as string,
      predictedImpact: 'Alternative impact could not be estimated from available data.'
    };
  }

  const actual = stressScore(pivotal.meterAfter);
  const diff = actual - best.score;

  if (diff > 4) {
    return {
      actionId: best.actionId,
      predictedImpact: `Projected to reduce immediate system stress by ~${diff.toFixed(1)} points with lower escalation carryover.`
    };
  }

  if (diff > 0) {
    return {
      actionId: best.actionId,
      predictedImpact: `Projected to modestly improve turn-level stability by ~${diff.toFixed(1)} points.`
    };
  }

  return {
    actionId: best.actionId,
    predictedImpact: 'Likely similar near-term outcome, but with different alliance and signaling profile.'
  };
};

const buildMisjudgments = (state: GameState): string[] => {
  const latest = state.history.slice(-3);
  if (latest.length === 0) {
    return [
      'Intel confidence was insufficient for robust misjudgment analysis.',
      'No completed turns were logged for post-game comparison.',
      'Run another episode to unlock comparative diagnostics.'
    ];
  }

  const mistakes: string[] = [];

  for (const entry of latest) {
    for (const [meter, range] of Object.entries(entry.visibleRanges)) {
      const trueValue = entry.meterAfter[meter as keyof MeterState];
      const midpoint = (range.low + range.high) / 2;
      const error = Math.abs(trueValue - midpoint);
      if (error >= 7) {
        mistakes.push(`Turn ${entry.turn}: ${meter} was misread by about ${error.toFixed(1)} points under noisy intel.`);
      }
      if (mistakes.length >= 3) {
        break;
      }
    }
    if (mistakes.length >= 3) {
      break;
    }
  }

  if (mistakes.length < 3) {
    const fill = [
      'Rival humiliation accumulated faster than visible indicators suggested.',
      'Alliance resilience appeared stronger than it was under repeated public signaling shocks.',
      'Escalation velocity from combined public and covert moves was underestimated.'
    ];
    for (const line of fill) {
      if (mistakes.length >= 3) {
        break;
      }
      mistakes.push(line);
    }
  }

  return mistakes;
};

export const buildPostGameReport = (
  state: GameState,
  actionMap: Map<string, ActionDefinition>
): PostGameReport => {
  const outcome = state.outcome ?? evaluateOutcome(state);
  const timeline = getTimeline(state);
  const pivotal = findPivotalTurn(state.history);
  const alternative = pickAlternative(pivotal, actionMap);

  return {
    episodeId: state.id,
    outcome,
    outcomeExplanation: describeOutcome(outcome),
    timeline,
    pivotalDecision: {
      turn: pivotal.turn,
      actionId: pivotal.playerActionId,
      reason: `This turn created the largest stress shift (${Math.abs(stressScore(pivotal.meterAfter) - stressScore(pivotal.meterBefore)).toFixed(1)} points).`
    },
    beliefEvolution: state.history.map((entry) => ({
      turn: entry.turn,
      bluffProb: Number(entry.beliefSnapshot.bluffProb.toFixed(3)),
      thresholdHighProb: Number(entry.beliefSnapshot.thresholdHighProb.toFixed(3)),
      humiliation: Number(entry.beliefSnapshot.humiliation.toFixed(3))
    })),
    misjudgments: buildMisjudgments(state),
    alternativeLine: {
      turn: pivotal.turn,
      suggestedActionId: alternative.actionId,
      predictedImpact: alternative.predictedImpact
    }
  };
};
