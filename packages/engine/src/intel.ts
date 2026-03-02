import type { GameState, MeterRange, MeterState } from '@wargames/shared-types';

import { SeededRng } from './rng';
import { clamp } from './utils';

const rangeWidth = (quality: number): number => {
  if (quality >= 85) {
    return 2;
  }
  if (quality >= 70) {
    return 4;
  }
  if (quality >= 55) {
    return 6;
  }
  if (quality >= 40) {
    return 9;
  }
  return 12;
};

export const degradeIntelQuality = (state: GameState): void => {
  const drift = state.intelQuality.expiresAtTurn && state.turn <= state.intelQuality.expiresAtTurn ? 0.4 : 1.8;

  for (const key of Object.keys(state.intelQuality.byMeter) as Array<keyof MeterState>) {
    state.intelQuality.byMeter[key] = clamp(state.intelQuality.byMeter[key] - drift, 28, 95);
  }

  if (state.intelQuality.expiresAtTurn && state.turn > state.intelQuality.expiresAtTurn) {
    state.intelQuality.expiresAtTurn = null;
  }
};

export const projectVisibleRanges = (
  state: GameState,
  rng: SeededRng
): Record<keyof MeterState, MeterRange> => {
  return (Object.keys(state.meters) as Array<keyof MeterState>).reduce(
    (accumulator, key) => {
      const quality = state.intelQuality.byMeter[key];
      const width = rangeWidth(quality);
      const centerNoise = rng.nextCenteredNoise(width * 0.2);
      const center = clamp(state.meters[key] + centerNoise);

      accumulator[key] = {
        low: clamp(Math.round(center - width)),
        high: clamp(Math.round(center + width)),
        confidence: Math.round(quality)
      };
      return accumulator;
    },
    {} as Record<keyof MeterState, MeterRange>
  );
};
