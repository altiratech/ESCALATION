import type {
  ActionDefinition,
  BeliefState,
  GameState,
  AdversaryProfile,
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
  adversaryProfile: AdversaryProfile,
  rng: SeededRng
): number => {
  const pressure = projectedPressure(state);
  const escalationNeed = pressure + beliefs.humiliation * adversaryProfile.egoSensitivity * 0.5;

  const strengthProjection =
    normalize(action.signal.resolveSignal) * adversaryProfile.priorities.projectStrength +
    normalize(action.signal.escalatory) * adversaryProfile.riskTolerance;

  const economyPenalty = normalize(action.signal.economicStressSignal) * adversaryProfile.priorities.preserveEconomy;
  const alliancePenalty = normalize(action.signal.allianceStressSignal) * adversaryProfile.priorities.avoidAllianceBreak;

  const covertBonus = action.visibility === 'secret' ? adversaryProfile.covertPreference : 1 - adversaryProfile.covertPreference;

  const bluffPunishBias = beliefs.bluffProb * adversaryProfile.bluffSensitivity;
  const perceivedWeaknessTarget = beliefs.economicallyWeakProb * 0.6 + beliefs.allianceFragileProb * 0.4;

  const assertiveBonus = normalize(action.signal.escalatory) * (escalationNeed + bluffPunishBias + perceivedWeaknessTarget * 0.3);
  const deescalationBonus = normalize(action.signal.deescalatory) * beliefs.deescalateUnderPressure * (1 - adversaryProfile.riskTolerance + 0.2);

  const imageModifier = beliefs.humiliation * adversaryProfile.egoSensitivity * normalize(action.signal.humiliationRisk);
  const noise = rng.nextCenteredNoise(0.08);

  return (
    strengthProjection * 1.1 +
    assertiveBonus * 1.4 +
    deescalationBonus * 0.9 +
    covertBonus * 0.45 +
    imageModifier * adversaryProfile.priorities.preserveImage -
    economyPenalty * 0.8 -
    alliancePenalty * 0.5 +
    noise
  );
};

export const chooseRivalAction = (
  state: GameState,
  scenario: ScenarioDefinition,
  adversaryProfile: AdversaryProfile,
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
    score: scoreRivalAction(action, state, beliefs, adversaryProfile, rng)
  }));

  scored.sort((left, right) => right.score - left.score);

  const topBand = scored.slice(0, Math.min(3, scored.length));
  const picked = rng.weightedPick(topBand, (entry) => Math.exp(entry.score));

  return picked.action;
};
