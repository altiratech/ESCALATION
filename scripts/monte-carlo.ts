import { actions, adversaryProfiles, images, scenarios } from '@wargames/content';
import { buildActionMap, initializeGameState, resolveTurn } from '@wargames/engine';
import type { ActionDefinition, GameState, OutcomeCategory, AdversaryProfile, ScenarioDefinition } from '@wargames/shared-types';

type PolicyId = 'all_hawk' | 'all_dove' | 'random' | 'adversarial';

const RUNS_PER_POLICY = Number(process.env.MONTE_CARLO_RUNS ?? 100);
const TURN_SAFETY_LIMIT = 30;

const actionMap = buildActionMap(actions);

const actionCandidates = (state: GameState): ActionDefinition[] => {
  return state.offeredActionIds
    .map((id) => actionMap.get(id))
    .filter((action): action is ActionDefinition => Boolean(action && action.actor === 'player'));
};

const pickByScore = (candidates: ActionDefinition[], score: (action: ActionDefinition) => number): ActionDefinition => {
  const ranked = [...candidates].sort((left, right) => score(right) - score(left));
  return ranked[0] as ActionDefinition;
};

const pseudoRandom = (seed: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0x100000000;
};

const chooseAction = (state: GameState, policy: PolicyId, seed: string): ActionDefinition => {
  const candidates = actionCandidates(state);
  if (candidates.length === 0) {
    throw new Error('No available actions for policy simulation.');
  }

  if (policy === 'all_hawk') {
    return pickByScore(candidates, (action) => (
      action.signal.escalatory * 1.4 +
      action.signal.resolveSignal * 0.65 +
      action.signal.humiliationRisk * 0.45 -
      action.signal.deescalatory * 0.7
    ));
  }

  if (policy === 'all_dove') {
    return pickByScore(candidates, (action) => (
      action.signal.deescalatory * 1.4 +
      action.signal.resolveSignal * 0.4 -
      action.signal.escalatory * 1.1 -
      action.signal.humiliationRisk * 0.35
    ));
  }

  if (policy === 'adversarial') {
    return pickByScore(candidates, (action) => (
      (action.immediateMeterDeltas.escalationIndex ?? 0) * 1.3 +
      -(action.immediateMeterDeltas.economicStability ?? 0) * 1.1 +
      -(action.immediateMeterDeltas.allianceTrust ?? 0) * 1.1 +
      -(action.immediateMeterDeltas.domesticCohesion ?? 0) * 1
    ));
  }

  const index = Math.floor(pseudoRandom(seed) * candidates.length) % candidates.length;
  return candidates[index] as ActionDefinition;
};

const runEpisode = (
  scenario: ScenarioDefinition,
  adversaryProfile: AdversaryProfile,
  policy: PolicyId,
  runSeed: string
): { outcome: OutcomeCategory | null; terminalBeatId: string; visitedBeats: Set<string> } => {
  let state = initializeGameState(`mc-${runSeed}`, runSeed, {
    scenario,
    adversaryProfile,
    actions,
    images
  });

  const visitedBeats = new Set<string>(state.beatHistory);

  for (let safety = 0; safety < TURN_SAFETY_LIMIT && state.status === 'active'; safety += 1) {
    const action = chooseAction(state, policy, `${runSeed}:${state.turn}:${policy}`);
    const { nextState } = resolveTurn(state, action.id, {
      scenario,
      adversaryProfile,
      actions,
      images
    });
    state = nextState;
    for (const beatId of state.beatHistory) {
      visitedBeats.add(beatId);
    }
  }

  if (state.status === 'active') {
    throw new Error(`Simulation safety limit reached before terminal state (${runSeed}).`);
  }

  return {
    outcome: state.outcome,
    terminalBeatId: state.currentBeatId,
    visitedBeats
  };
};

const policies: PolicyId[] = ['all_hawk', 'all_dove', 'random', 'adversarial'];

let failed = false;

for (const scenario of scenarios) {
  const globalBeatCoverage = new Set<string>();
  const terminalDistribution = new Map<string, number>();

  for (const adversaryProfile of adversaryProfiles) {
    for (const policy of policies) {
      const policyTerminalDistribution = new Map<string, number>();
      let runs = 0;

      for (let index = 0; index < RUNS_PER_POLICY; index += 1) {
        const runSeed = `${scenario.id}:${adversaryProfile.id}:${policy}:${index}`;
        const result = runEpisode(scenario, adversaryProfile, policy, runSeed);
        runs += 1;

        terminalDistribution.set(result.terminalBeatId, (terminalDistribution.get(result.terminalBeatId) ?? 0) + 1);
        policyTerminalDistribution.set(
          result.terminalBeatId,
          (policyTerminalDistribution.get(result.terminalBeatId) ?? 0) + 1
        );

        for (const beatId of result.visitedBeats) {
          globalBeatCoverage.add(beatId);
        }
      }

      const policyTopTerminal = [...policyTerminalDistribution.entries()].sort((a, b) => b[1] - a[1])[0];
      const policyTop = policyTopTerminal?.[1] ?? 0;
      const policyShare = policyTop / Math.max(1, runs);
      if (policyShare > 0.8) {
        console.warn(
          `[WARN] Highly concentrated policy distribution for ${scenario.id}/${adversaryProfile.id}/${policy}: ${(policyShare * 100).toFixed(1)}% at ${policyTopTerminal?.[0] ?? 'unknown'}`
        );
      }
    }
  }

  const totalRuns = adversaryProfiles.length * policies.length * RUNS_PER_POLICY;
  const terminalEntries = [...terminalDistribution.entries()].sort((a, b) => b[1] - a[1]);
  const topTerminal = terminalEntries[0];
  const topShare = (topTerminal?.[1] ?? 0) / Math.max(1, totalRuns);

  if (topShare > 0.8) {
    failed = true;
    console.error(
      `[FAIL] Degenerate overall distribution for ${scenario.id}: ${(topShare * 100).toFixed(1)}% end at ${topTerminal?.[0] ?? 'unknown'}`
    );
  }

  const unvisited = scenario.beats.map((beat) => beat.id).filter((beatId) => !globalBeatCoverage.has(beatId));
  if (unvisited.length > 0) {
    failed = true;
    console.error(`[FAIL] Monte Carlo did not visit all beats for ${scenario.id}. Missing: ${unvisited.join(', ')}`);
  }

  console.log(`Scenario ${scenario.id}`);
  console.log(`  Total runs: ${totalRuns}`);
  console.log(`  Unique terminal beats: ${terminalDistribution.size}`);
  console.log(`  Top terminal share: ${(topShare * 100).toFixed(1)}% at ${topTerminal?.[0] ?? 'unknown'}`);
  console.log(
    `  Terminal distribution: ${terminalEntries
      .map(([terminalBeatId, count]) => `${terminalBeatId}=${count}`)
      .join(', ')}`
  );
  console.log(`  Beat coverage: ${globalBeatCoverage.size}/${scenario.beats.length}`);
}

if (failed) {
  process.exit(1);
}
