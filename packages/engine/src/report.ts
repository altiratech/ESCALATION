import type {
  ActionDefinition,
  BranchCondition,
  EventDefinition,
  GameState,
  MeterKey,
  MeterState,
  PostGameReport,
  ReportTimelinePoint,
  AdversaryProfile,
  ScenarioDefinition,
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

const meterDisplayName: Record<MeterKey, string> = {
  economicStability: 'economic stability',
  energySecurity: 'energy security',
  domesticCohesion: 'domestic cohesion',
  militaryReadiness: 'military readiness',
  allianceTrust: 'alliance trust',
  escalationIndex: 'escalation pressure'
};

const meterKeys: MeterKey[] = [
  'economicStability',
  'energySecurity',
  'domesticCohesion',
  'militaryReadiness',
  'allianceTrust',
  'escalationIndex'
];

const round = (value: number): number => Number(value.toFixed(2));

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

const addMeterDeltas = (target: Record<MeterKey, number>, deltas: Partial<MeterState> | undefined): void => {
  if (!deltas) {
    return;
  }
  for (const meter of meterKeys) {
    const delta = deltas[meter];
    if (typeof delta === 'number') {
      target[meter] += delta;
    }
  }
};

const computeHiddenDeltas = (
  state: GameState,
  actionMap: Map<string, ActionDefinition>,
  scenario?: ScenarioDefinition
): PostGameReport['fullCausality']['hiddenDeltas'] => {
  const eventMap = new Map<string, EventDefinition>((scenario?.eventTable ?? []).map((event) => [event.id, event]));
  const aggregate: Record<MeterKey, { player: number; rival: number; event: number; system: number; total: number }> = {
    economicStability: { player: 0, rival: 0, event: 0, system: 0, total: 0 },
    energySecurity: { player: 0, rival: 0, event: 0, system: 0, total: 0 },
    domesticCohesion: { player: 0, rival: 0, event: 0, system: 0, total: 0 },
    militaryReadiness: { player: 0, rival: 0, event: 0, system: 0, total: 0 },
    allianceTrust: { player: 0, rival: 0, event: 0, system: 0, total: 0 },
    escalationIndex: { player: 0, rival: 0, event: 0, system: 0, total: 0 }
  };

  for (const entry of state.history) {
    const known: Record<MeterKey, number> = {
      economicStability: 0,
      energySecurity: 0,
      domesticCohesion: 0,
      militaryReadiness: 0,
      allianceTrust: 0,
      escalationIndex: 0
    };

    const playerAction = actionMap.get(entry.playerActionId);
    if (playerAction?.actor === 'player') {
      addMeterDeltas(known, playerAction.immediateMeterDeltas);
      for (const meter of meterKeys) {
        aggregate[meter].player += playerAction.immediateMeterDeltas[meter] ?? 0;
      }
    }

    const rivalAction = actionMap.get(entry.rivalActionId);
    if (rivalAction?.actor === 'rival') {
      addMeterDeltas(known, rivalAction.immediateMeterDeltas);
      for (const meter of meterKeys) {
        aggregate[meter].rival += rivalAction.immediateMeterDeltas[meter] ?? 0;
      }
    }

    for (const eventId of entry.triggeredEvents) {
      const event = eventMap.get(eventId);
      if (!event) {
        continue;
      }
      addMeterDeltas(known, event.meterDeltas);
      for (const meter of meterKeys) {
        aggregate[meter].event += event.meterDeltas[meter] ?? 0;
      }
    }

    for (const meter of meterKeys) {
      const actual = entry.meterAfter[meter] - entry.meterBefore[meter];
      const residual = actual - known[meter];
      aggregate[meter].system += residual;
      aggregate[meter].total += actual;
    }
  }

  return meterKeys.map((meter) => {
    const totals = aggregate[meter];
    const breakdown = ([
      { source: 'player', delta: totals.player },
      { source: 'rival', delta: totals.rival },
      { source: 'event', delta: totals.event },
      { source: 'system', delta: totals.system }
    ] as const)
      .filter((entry) => Math.abs(entry.delta) >= 0.25)
      .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
      .map((entry) => ({
        source: entry.source,
        delta: round(entry.delta)
      }));

    return {
      meter,
      totalDelta: round(totals.total),
      breakdown
    };
  });
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

const formatConditionOp = (op: BranchCondition['conditions'][number]['op']): string => {
  if (op === 'lt') return '<';
  if (op === 'lte') return '<=';
  if (op === 'gt') return '>';
  if (op === 'gte') return '>=';
  return '=';
};

const branchSort = (left: BranchCondition, right: BranchCondition): number => {
  const leftPriority = left.priority ?? 0;
  const rightPriority = right.priority ?? 0;
  if (leftPriority !== rightPriority) {
    return rightPriority - leftPriority;
  }
  return 0;
};

const readConditionObserved = (entry: TurnHistoryEntry, condition: BranchCondition['conditions'][number]): number | null => {
  if (condition.source === 'meter') {
    const value = entry.meterAfter[condition.key as MeterKey];
    return typeof value === 'number' ? value : null;
  }
  if (condition.source === 'belief') {
    const value = entry.beliefSnapshot[condition.key as keyof typeof entry.beliefSnapshot];
    return typeof value === 'number' ? value : null;
  }
  return null;
};

const buildBranchReason = (
  entry: TurnHistoryEntry,
  selectedAction: ActionDefinition | null,
  branch: BranchCondition
): string => {
  if (branch.requiresActionTag && !(selectedAction?.tags.includes(branch.requiresActionTag) ?? false)) {
    return `Requires action tag "${branch.requiresActionTag}", which the selected action did not provide.`;
  }

  const failed = branch.conditions.find((condition) => {
    const observed = readConditionObserved(entry, condition);
    if (observed === null) {
      return true;
    }
    return !compare(observed, condition.op, condition.value);
  });

  if (failed) {
    const observed = readConditionObserved(entry, failed);
    if (observed === null) {
      if (failed.source === 'latent') {
        return `Depends on latent-state gate (${failed.key}) that remained hidden during turn-time output.`;
      }
      return `Condition on ${failed.key} could not be reconstructed from turn-time visible state.`;
    }
    return `Gate not met: ${failed.key} ${formatConditionOp(failed.op)} ${failed.value} (observed ${round(observed)}).`;
  }

  return 'A higher-priority branch resolved first under this turn state.';
};

const buildBranchNotTaken = (
  state: GameState,
  actionMap: Map<string, ActionDefinition>,
  scenario?: ScenarioDefinition
): PostGameReport['fullCausality']['branchesNotTaken'] => {
  if (!scenario) {
    return [];
  }

  const beatMap = new Map(scenario.beats.map((beat) => [beat.id, beat]));
  const summaries: PostGameReport['fullCausality']['branchesNotTaken'] = [];

  for (const entry of state.history) {
    const beat = beatMap.get(entry.beatIdBefore);
    if (!beat || beat.branches.length === 0) {
      continue;
    }

    const selectedAction = actionMap.get(entry.playerActionId) ?? null;
    const alternatives = [...beat.branches]
      .sort(branchSort)
      .filter((branch) => branch.targetBeatId !== entry.beatIdAfter)
      .map((branch) => ({
        targetBeatId: branch.targetBeatId,
        reason: buildBranchReason(entry, selectedAction, branch)
      }));

    if (alternatives.length === 0) {
      continue;
    }

    summaries.push({
      turn: entry.turn,
      beatId: entry.beatIdBefore,
      selectedActionId: entry.playerActionId,
      selectedBeatId: entry.beatIdAfter,
      alternatives: alternatives.slice(0, 3)
    });
  }

  return summaries;
};

const buildUnseenSystemEvents = (
  state: GameState,
  scenario?: ScenarioDefinition
): PostGameReport['fullCausality']['unseenSystemEvents'] => {
  if (!scenario) {
    return [];
  }

  const eventMap = new Map<string, EventDefinition>(scenario.eventTable.map((event) => [event.id, event]));
  const unseen: PostGameReport['fullCausality']['unseenSystemEvents'] = [];

  for (const entry of state.history) {
    for (const eventId of entry.triggeredEvents) {
      const event = eventMap.get(eventId);
      if (!event || event.publicVisibility >= 0.7) {
        continue;
      }

      unseen.push({
        turn: entry.turn,
        eventId: event.id,
        label: event.label,
        visibility: event.publicVisibility,
        meterDeltas: event.meterDeltas
      });
    }
  }

  return unseen.slice(0, 8);
};

const applyTemplate = (template: string, replacements: Record<string, string>): string => {
  return template.replace(/\{([a-z_]+)\}/g, (_, key: string) => replacements[key] ?? 'unknown');
};

const derivePrimaryDriver = (hiddenDeltas: PostGameReport['fullCausality']['hiddenDeltas']): string => {
  const ranked = [...hiddenDeltas].sort((left, right) => Math.abs(right.totalDelta) - Math.abs(left.totalDelta));
  const top = ranked[0];
  if (!top) {
    return 'cumulative multi-domain pressure';
  }

  if (top.meter === 'escalationIndex' && top.totalDelta > 0) {
    return 'sustained escalation pressure';
  }

  const direction = top.totalDelta >= 0 ? 'upward drift' : 'erosion';
  return `${meterDisplayName[top.meter]} ${direction}`;
};

const buildAdversaryLogicSummary = (
  state: GameState,
  actionMap: Map<string, ActionDefinition>,
  adversaryProfile?: AdversaryProfile
): string => {
  const rivalActions = state.history
    .map((entry) => actionMap.get(entry.rivalActionId))
    .filter((action): action is ActionDefinition => Boolean(action && action.actor === 'rival'));

  if (rivalActions.length === 0) {
    return 'Insufficient rival-action history to reconstruct adversary logic for this run.';
  }

  const escalatoryTurns = rivalActions.filter((action) => action.signal.escalatory >= action.signal.deescalatory).length;
  const deescalatoryTurns = rivalActions.length - escalatoryTurns;
  const avgHumiliation = state.history.reduce((sum, entry) => sum + entry.beliefSnapshot.humiliation, 0) / state.history.length;
  const avgThreshold = state.history.reduce((sum, entry) => sum + entry.beliefSnapshot.thresholdHighProb, 0) / state.history.length;
  const avgBluff = state.history.reduce((sum, entry) => sum + entry.beliefSnapshot.bluffProb, 0) / state.history.length;

  const stance =
    escalatoryTurns > deescalatoryTurns
      ? 'favored coercive signaling'
      : deescalatoryTurns > escalatoryTurns
        ? 'favored controlled de-escalation windows'
        : 'oscillated between escalation and restraint';

  const profileLabel = adversaryProfile?.name ?? 'Scenario-embedded adversary model';
  return `${profileLabel} ${stance}. Rival action mix was ${escalatoryTurns}/${rivalActions.length} escalatory-coded turns, with mean threshold belief ${avgThreshold.toFixed(2)}, bluff belief ${avgBluff.toFixed(2)}, and humiliation pressure ${avgHumiliation.toFixed(2)}.`;
};

export interface BuildPostGameReportOptions {
  scenario?: ScenarioDefinition;
  adversaryProfile?: AdversaryProfile;
  causalityNarrative?: {
    title: string | null;
    summary: string | null;
    causalNote: string | null;
  };
  advisorRetrospectives?: Array<{ advisor: string; text: string }>;
}

export const buildPostGameReport = (
  state: GameState,
  actionMap: Map<string, ActionDefinition>,
  options: BuildPostGameReportOptions = {}
): PostGameReport => {
  const outcome = state.outcome ?? evaluateOutcome(state);
  const timeline = getTimeline(state);
  const pivotal = findPivotalTurn(state.history);
  const alternative = pickAlternative(pivotal, actionMap);
  const hiddenDeltas = computeHiddenDeltas(state, actionMap, options.scenario);
  const unseenSystemEvents = buildUnseenSystemEvents(state, options.scenario);
  const branchesNotTaken = buildBranchNotTaken(state, actionMap, options.scenario);
  const primaryDriver = derivePrimaryDriver(hiddenDeltas);
  const peakEscalationTurn = [...state.history].sort(
    (left, right) => right.meterAfter.escalationIndex - left.meterAfter.escalationIndex
  )[0];
  const pivotalActionName = actionMap.get(pivotal.playerActionId)?.name ?? pivotal.playerActionId;
  const unseenCritical = unseenSystemEvents.find((entry) => entry.turn === pivotal.turn) ?? unseenSystemEvents[0];
  const cascadeTurn = state.history.find((entry) => entry.meterAfter.economicStability < 38);
  const cascadeActionName = cascadeTurn ? actionMap.get(cascadeTurn.playerActionId)?.name ?? cascadeTurn.playerActionId : 'compounded policy friction';
  const finalTurn = state.history[state.history.length - 1]?.turn ?? state.turn;

  const templateValues: Record<string, string> = {
    resolution_turn: String(finalTurn),
    peak_escalation: String(round(peakEscalationTurn?.meterAfter.escalationIndex ?? state.meters.escalationIndex)),
    peak_turn: String(peakEscalationTurn?.turn ?? finalTurn),
    critical_turn: String(pivotal.turn),
    critical_action: pivotalActionName,
    primary_driver: primaryDriver,
    final_econ: String(round(state.meters.economicStability)),
    final_cohesion: String(round(state.meters.domesticCohesion)),
    cascade_turn: String(cascadeTurn?.turn ?? pivotal.turn),
    cascade_trigger: cascadeActionName,
    critical_event: unseenCritical?.label ?? 'an underreported systems shock',
    player_focus: pivotalActionName
  };

  const narrativeTitle = options.causalityNarrative?.title ?? `${outcome.replace('_', ' ')} outcome`;
  const narrativeSummary = options.causalityNarrative?.summary ?? describeOutcome(outcome);
  const causalTemplate = options.causalityNarrative?.causalNote ?? 'Primary driver: {primary_driver}. Critical turn: {critical_turn} via {critical_action}.';
  const causalNote = applyTemplate(causalTemplate, templateValues);

  const advisorRetrospectives = (options.advisorRetrospectives ?? []).map((entry) => ({
    advisor: entry.advisor,
    text: entry.text
  }));

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
    },
    fullCausality: {
      outcomeNarrative: {
        title: narrativeTitle,
        summary: narrativeSummary,
        causalNote
      },
      hiddenDeltas,
      adversaryLogicSummary: buildAdversaryLogicSummary(state, actionMap, options.adversaryProfile),
      unseenSystemEvents,
      branchesNotTaken,
      advisorRetrospectives
    }
  };
};
