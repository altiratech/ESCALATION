import type {
  ActionDefinition,
  BeliefState,
  GameState,
  RivalArchetype,
  TurnResolution
} from '@wargames/shared-types';

import { SeededRng } from './rng';
import { clampProbability, ratio } from './utils';

const boundedNoise = (rng: SeededRng, scale = 0.025): number => rng.nextCenteredNoise(scale);

export const updateBeliefs = (
  beliefs: BeliefState,
  playerAction: ActionDefinition,
  state: GameState,
  rivalArchetype: RivalArchetype,
  rng: SeededRng
): BeliefState => {
  const next: BeliefState = { ...beliefs };

  const escalationPressure = ratio(state.meters.escalationIndex);
  const economyWeakness = ratio(100 - state.meters.economicStability);
  const allianceFragility = ratio(100 - state.meters.allianceTrust);

  next.bluffProb = clampProbability(
    next.bluffProb + (playerAction.signal.bluffSignal * 0.12) - (playerAction.signal.resolveSignal * 0.08) + boundedNoise(rng)
  );

  next.thresholdHighProb = clampProbability(
    next.thresholdHighProb + (playerAction.signal.deescalatory * 0.09) - (playerAction.signal.escalatory * 0.06) + boundedNoise(rng)
  );

  next.economicallyWeakProb = clampProbability(
    next.economicallyWeakProb + (economyWeakness * 0.14) + (playerAction.signal.economicStressSignal * 0.1) + boundedNoise(rng)
  );

  next.allianceFragileProb = clampProbability(
    next.allianceFragileProb + (allianceFragility * 0.12) + (playerAction.signal.allianceStressSignal * 0.12) + boundedNoise(rng)
  );

  const velocityDelta = (playerAction.signal.escalatory - playerAction.signal.deescalatory) * 0.16;
  next.escalationVelocity = clampProbability(next.escalationVelocity * 0.72 + escalationPressure * 0.18 + velocityDelta + boundedNoise(rng, 0.04));

  const pressureSignal = ratio(state.latent.rivalDomesticPressure);
  next.deescalateUnderPressure = clampProbability(
    next.deescalateUnderPressure + ((playerAction.signal.deescalatory + 0.15) * 0.08) + ((1 - pressureSignal) * 0.05) + boundedNoise(rng)
  );

  const humiliationImpulse =
    Math.max(0, playerAction.signal.humiliationRisk) *
    (playerAction.visibility === 'public' ? 0.14 : 0.06) *
    rivalArchetype.egoSensitivity;
  next.humiliation = clampProbability(next.humiliation * 0.7 + humiliationImpulse + boundedNoise(rng, 0.03));

  return next;
};

export const summarizeBeliefShift = (
  before: BeliefState,
  after: BeliefState
): Array<{ key: keyof BeliefState; shift: number }> => {
  const keys: Array<keyof BeliefState> = [
    'bluffProb',
    'thresholdHighProb',
    'economicallyWeakProb',
    'allianceFragileProb',
    'escalationVelocity',
    'deescalateUnderPressure',
    'humiliation'
  ];

  return keys
    .map((key) => ({ key, shift: after[key] - before[key] }))
    .sort((left, right) => Math.abs(right.shift) - Math.abs(left.shift));
};

export const beliefSnapshotFromResolution = (resolution: TurnResolution): Pick<BeliefState, 'bluffProb' | 'thresholdHighProb' | 'humiliation'> => {
  return {
    bluffProb: resolution.beliefsAfter.bluffProb,
    thresholdHighProb: resolution.beliefsAfter.thresholdHighProb,
    humiliation: resolution.beliefsAfter.humiliation
  };
};
