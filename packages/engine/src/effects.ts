import type {
  ActionDefinition,
  ActionDelayedEffectDefinition,
  ActionVariantDefinition,
  DelayedEffect,
  GameState,
  MeterState,
  SideEffectDefinition
} from '@wargames/shared-types';

import { SeededRng } from './rng';
import { applyLatentDeltas, applyMeterDeltas, clamp } from './utils';

export interface AppliedActionResult {
  triggeredSideEffects: string[];
}

const applySideEffect = (state: GameState, sideEffect: SideEffectDefinition): void => {
  state.meters = applyMeterDeltas(state.meters, sideEffect.meterDeltas);
  state.latent = applyLatentDeltas(state.latent, sideEffect.latentDeltas);
};

export const getActionVariant = (
  action: ActionDefinition,
  variantId?: string | null
): ActionVariantDefinition | null => {
  if (!action.variants || action.variants.length === 0) {
    return null;
  }

  if (variantId) {
    return action.variants.find((variant) => variant.id === variantId) ?? null;
  }

  return (
    action.variants.find((variant) => variant.id === action.defaultVariantId) ??
    action.variants.find((variant) => variant.isDefault) ??
    action.variants[0] ??
    null
  );
};

const queueDelayedEffects = (
  state: GameState,
  actionId: string,
  delayedEffects: ActionDelayedEffectDefinition[],
  actor: 'player' | 'rival'
): void => {
  for (const delayed of delayedEffects) {
    const item: DelayedEffect = {
      id: `${actionId}:${state.turn}:${delayed.delayTurns}:${Math.round(delayed.chance * 100)}`,
      sourceActionId: actionId,
      sourceActor: actor,
      applyOnTurn: state.turn + delayed.delayTurns,
      chance: delayed.chance,
      meterDeltas: delayed.meterDeltas,
      description: delayed.description
    };

    if (delayed.latentDeltas) {
      item.latentDeltas = delayed.latentDeltas;
    }

    state.delayedQueue.push(item);
  }
};

export const applyActionToState = (
  state: GameState,
  action: ActionDefinition,
  actor: 'player' | 'rival',
  rng: SeededRng,
  pressureMultiplier: number,
  variantId?: string | null
): AppliedActionResult => {
  const variant = actor === 'player' ? getActionVariant(action, variantId) : null;

  state.meters = applyMeterDeltas(state.meters, action.immediateMeterDeltas, pressureMultiplier);
  state.latent = applyLatentDeltas(state.latent, action.immediateLatentDeltas, pressureMultiplier);
  if (variant?.immediateMeterDeltas) {
    state.meters = applyMeterDeltas(state.meters, variant.immediateMeterDeltas, pressureMultiplier);
  }
  if (variant?.immediateLatentDeltas) {
    state.latent = applyLatentDeltas(state.latent, variant.immediateLatentDeltas, pressureMultiplier);
  }

  const triggeredSideEffects: string[] = [];

  for (const sideEffect of action.sideEffects) {
    const adjustedChance = clamp(sideEffect.chance * pressureMultiplier, 0, 0.92);
    if (rng.chance(adjustedChance)) {
      applySideEffect(state, sideEffect);
      triggeredSideEffects.push(sideEffect.narrativeToken);
    }
  }

  if (action.intelQualityBoost && actor === 'player') {
    for (const meterKey of Object.keys(state.intelQuality.byMeter) as Array<keyof MeterState>) {
      state.intelQuality.byMeter[meterKey] = clamp(state.intelQuality.byMeter[meterKey] + action.intelQualityBoost * 0.4);
    }
    state.intelQuality.expiresAtTurn = state.turn + 2;
  }

  queueDelayedEffects(state, action.id, action.delayedEffects, actor);
  if (variant?.delayedEffects?.length) {
    queueDelayedEffects(state, `${action.id}:${variant.id}`, variant.delayedEffects, actor);
  }
  return { triggeredSideEffects };
};

export const applyDueDelayedEffects = (
  state: GameState,
  rng: SeededRng,
  pressureMultiplier: number
): string[] => {
  const remaining: DelayedEffect[] = [];
  const triggered: string[] = [];

  for (const delayed of state.delayedQueue) {
    if (delayed.applyOnTurn > state.turn) {
      remaining.push(delayed);
      continue;
    }

    const chance = clamp(delayed.chance * pressureMultiplier, 0, 1);
    if (!rng.chance(chance)) {
      continue;
    }

    state.meters = applyMeterDeltas(state.meters, delayed.meterDeltas);
    state.latent = applyLatentDeltas(state.latent, delayed.latentDeltas);
    triggered.push(delayed.description);
  }

  state.delayedQueue = remaining;
  return triggered;
};
