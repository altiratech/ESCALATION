import type { EventCondition, EventDefinition, GameState } from '@wargames/shared-types';

import { SeededRng } from './rng';
import { applyLatentDeltas, applyMeterDeltas, clamp, ratio } from './utils';

export interface TriggeredEvent {
  id: string;
  token: string;
}

const evaluateCondition = (state: GameState, condition: EventCondition): boolean => {
  const value = condition.meter
    ? state.meters[condition.meter]
    : state.latent[condition.latent ?? 'globalLegitimacy'];

  if (condition.op === 'lt') {
    return value < condition.value;
  }
  if (condition.op === 'lte') {
    return value <= condition.value;
  }
  if (condition.op === 'gt') {
    return value > condition.value;
  }
  return value >= condition.value;
};

const chanceMultiplier = (state: GameState, event: EventDefinition): number => {
  let multiplier = 1;

  if (event.id === 'protests_erupt') {
    multiplier += ratio(100 - state.meters.domesticCohesion) * 0.8;
  }

  if (event.id === 'blackout') {
    multiplier += ratio(100 - state.meters.energySecurity) * 0.7;
    if (state.latent.vulnerabilityFlags.includes('grid_fragile')) {
      multiplier += 0.25;
    }
  }

  if (event.id === 'market_panic') {
    multiplier += ratio(100 - state.meters.economicStability) * 0.7;
    multiplier += ratio(state.meters.escalationIndex) * 0.5;
  }

  if (event.id === 'ally_distances_publicly') {
    multiplier += ratio(100 - state.meters.allianceTrust) * 0.7;
    if (state.latent.vulnerabilityFlags.includes('coalition_fragile')) {
      multiplier += 0.2;
    }
  }

  if (event.id === 'rogue_actor_incident') {
    multiplier += ratio(state.meters.escalationIndex) * 0.65;
    multiplier += ratio(state.meters.militaryReadiness) * 0.25;
  }

  return clamp(multiplier, 0.35, 2.35);
};

export const triggerEvents = (
  state: GameState,
  events: EventDefinition[],
  rng: SeededRng,
  pressureMultiplier: number
): TriggeredEvent[] => {
  const triggered: TriggeredEvent[] = [];

  for (const event of events) {
    const conditionsMet = event.conditions.every((condition) => evaluateCondition(state, condition));
    if (!conditionsMet) {
      continue;
    }

    const probability = event.baseChance * chanceMultiplier(state, event) * pressureMultiplier;
    if (!rng.chance(clamp(probability, 0, 0.96))) {
      continue;
    }

    state.meters = applyMeterDeltas(state.meters, event.meterDeltas);
    state.latent = applyLatentDeltas(state.latent, event.latentDeltas);

    triggered.push({ id: event.id, token: event.narrativeToken });
  }

  return triggered;
};
