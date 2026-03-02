import {
  METER_KEYS,
  type LatentState,
  type MeterKey,
  type MeterState
} from '@wargames/shared-types';

export const clamp = (value: number, min = 0, max = 100): number => {
  return Math.max(min, Math.min(max, value));
};

export const clampProbability = (value: number): number => clamp(value, 0, 1);

export const deepClone = <T>(value: T): T => {
  return structuredClone(value);
};

export const hashSeed = (seed: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const meterDeltaMagnitude = (before: MeterState, after: MeterState): number => {
  return METER_KEYS.reduce((sum, key) => sum + Math.abs(after[key] - before[key]), 0);
};

export const applyMeterDeltas = (
  target: MeterState,
  deltas: Partial<MeterState>,
  multiplier = 1
): MeterState => {
  const next = { ...target };
  for (const key of METER_KEYS) {
    const delta = deltas[key] ?? 0;
    if (!delta) {
      continue;
    }
    next[key] = clamp(next[key] + delta * multiplier);
  }
  return next;
};

export const applyLatentDeltas = (
  target: LatentState,
  deltas: Partial<Omit<LatentState, 'vulnerabilityFlags'>> | undefined,
  multiplier = 1
): LatentState => {
  if (!deltas) {
    return target;
  }

  return {
    ...target,
    globalLegitimacy: clamp(target.globalLegitimacy + (deltas.globalLegitimacy ?? 0) * multiplier),
    rivalDomesticPressure: clamp(target.rivalDomesticPressure + (deltas.rivalDomesticPressure ?? 0) * multiplier),
    playerDomesticApproval: clamp(target.playerDomesticApproval + (deltas.playerDomesticApproval ?? 0) * multiplier)
  };
};

export const getDominantDomain = (deltas: Partial<MeterState>): string => {
  const domainWeights: Record<string, number> = {
    economy: 0,
    energy: 0,
    unrest: 0,
    military: 0,
    diplomacy: 0,
    cyber: 0
  };

  const map: Record<MeterKey, keyof typeof domainWeights> = {
    economicStability: 'economy',
    energySecurity: 'energy',
    domesticCohesion: 'unrest',
    militaryReadiness: 'military',
    allianceTrust: 'diplomacy',
    escalationIndex: 'military'
  };

  for (const key of METER_KEYS) {
    const value = Math.abs(deltas[key] ?? 0);
    const domain = map[key];
    if (!domain) {
      continue;
    }
    domainWeights[domain] = (domainWeights[domain] ?? 0) + value;
  }

  const sorted = Object.entries(domainWeights).sort((left, right) => right[1] - left[1]);
  return sorted[0]?.[0] ?? 'diplomacy';
};

export const ratio = (value: number): number => clamp(value / 100, 0, 1);

export const asRecord = <T extends string, V>(keys: readonly T[], valueFactory: (key: T) => V): Record<T, V> => {
  return keys.reduce((accumulator, key) => {
    accumulator[key] = valueFactory(key);
    return accumulator;
  }, {} as Record<T, V>);
};
