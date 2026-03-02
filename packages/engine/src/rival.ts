import type {
  ActionDefinition,
  BeliefState,
  GameState,
  RivalArchetype,
  ScenarioDefinition
} from '@wargames/shared-types';

import { SeededRng } from './rng';
import { clampProbability, ratio } from './utils';

interface RivalScoredAction {
  action: ActionDefinition;
  score: number;
}

const normalize = (value: number): number => clampProbability((value + 1) / 2);

const projectedPressure = (state: GameState): number => {
  return ratio(state.meters.escalationIndex) * 0.6 + ratio(state.latent.rivalDomesticPressure) * 0.4;
};

export const scoreRivalAction = (
  action: ActionDefinition,
  state: GameState,
  beliefs: BeliefState,
  archetype: RivalArchetype,
  rng: SeededRng
): number => {
  const pressure = projectedPressure(state);
  const escalationNeed = pressure + beliefs.humiliation * archetype.egoSensitivity * 0.5;

  const strengthProjection =
    normalize(action.signal.resolveSignal) * archetype.priorities.projectStrength +
    normalize(action.signal.escalatory) * archetype.riskTolerance;

  const economyPenalty = normalize(action.signal.economicStressSignal) * archetype.priorities.preserveEconomy;
  const alliancePenalty = normalize(action.signal.allianceStressSignal) * archetype.priorities.avoidAllianceBreak;

  const covertBonus = action.visibility === 'secret' ? archetype.covertPreference : 1 - archetype.covertPreference;

  const bluffPunishBias = beliefs.bluffProb * archetype.bluffSensitivity;
  const perceivedWeaknessTarget = beliefs.economicallyWeakProb * 0.6 + beliefs.allianceFragileProb * 0.4;

  const assertiveBonus = normalize(action.signal.escalatory) * (escalationNeed + bluffPunishBias + perceivedWeaknessTarget * 0.3);
  const deescalationBonus = normalize(action.signal.deescalatory) * beliefs.deescalateUnderPressure * (1 - archetype.riskTolerance + 0.2);

  const imageModifier = beliefs.humiliation * archetype.egoSensitivity * normalize(action.signal.humiliationRisk);
  const noise = rng.nextCenteredNoise(0.08);

  return (
    strengthProjection * 1.1 +
    assertiveBonus * 1.4 +
    deescalationBonus * 0.9 +
    covertBonus * 0.45 +
    imageModifier * archetype.priorities.preserveImage -
    economyPenalty * 0.8 -
    alliancePenalty * 0.5 +
    noise
  );
};

export const chooseRivalAction = (
  state: GameState,
  scenario: ScenarioDefinition,
  archetype: RivalArchetype,
  beliefs: BeliefState,
  actionMap: Map<string, ActionDefinition>,
  rng: SeededRng
): ActionDefinition => {
  const candidates = scenario.availableRivalActionIds
    .map((id) => actionMap.get(id))
    .filter((entry): entry is ActionDefinition => Boolean(entry));

  if (candidates.length === 0) {
    throw new Error('No rival actions available for scenario.');
  }

  const scored: RivalScoredAction[] = candidates.map((action) => ({
    action,
    score: scoreRivalAction(action, state, beliefs, archetype, rng)
  }));

  scored.sort((left, right) => right.score - left.score);

  const topBand = scored.slice(0, Math.min(3, scored.length));
  const picked = rng.weightedPick(topBand, (entry) => Math.exp(entry.score));

  return picked.action;
};
