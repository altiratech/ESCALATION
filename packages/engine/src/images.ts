import type { ImageAsset, MeterState, ScenarioDefinition } from '@wargames/shared-types';

import { SeededRng } from './rng';

const classifyDomain = (delta: Partial<MeterState>): ImageAsset['domain'] => {
  const scores: Record<ImageAsset['domain'], number> = {
    economy: Math.abs(delta.economicStability ?? 0),
    energy: Math.abs(delta.energySecurity ?? 0),
    unrest: Math.abs(delta.domesticCohesion ?? 0),
    military: Math.abs(delta.militaryReadiness ?? 0) + Math.abs(delta.escalationIndex ?? 0) * 0.6,
    cyber: Math.abs(delta.energySecurity ?? 0) * 0.3,
    diplomacy: Math.abs(delta.allianceTrust ?? 0)
  };

  const ranked = Object.entries(scores).sort((left, right) => right[1] - left[1]);
  return (ranked[0]?.[0] as ImageAsset['domain']) ?? 'diplomacy';
};

const classifySeverity = (meters: MeterState): ImageAsset['severity'] => {
  const stress =
    (100 - meters.economicStability) * 0.18 +
    (100 - meters.energySecurity) * 0.14 +
    (100 - meters.domesticCohesion) * 0.18 +
    meters.escalationIndex * 0.3 +
    (100 - meters.allianceTrust) * 0.2;

  if (stress > 75) {
    return 4;
  }
  if (stress > 62) {
    return 3;
  }
  if (stress > 48) {
    return 2;
  }
  if (stress > 35) {
    return 1;
  }
  return 0;
};

export const chooseImageAsset = (
  assets: ImageAsset[],
  scenario: ScenarioDefinition,
  meters: MeterState,
  turnDelta: Partial<MeterState>,
  recentImageIds: string[],
  rng: SeededRng
): ImageAsset | null => {
  if (assets.length === 0) {
    return null;
  }

  const domain = classifyDomain(turnDelta);
  const severity = classifySeverity(meters);

  const candidates = assets
    .filter((asset) => asset.environment === scenario.environment || asset.environment === 'generic')
    .filter((asset) => asset.domain === domain || asset.domain === 'diplomacy')
    .filter((asset) => Math.abs(asset.severity - severity) <= 1)
    .filter((asset) => !recentImageIds.includes(asset.id));

  if (candidates.length === 0) {
    return assets.find((asset) => !recentImageIds.includes(asset.id)) ?? assets[0] ?? null;
  }

  return rng.pick(candidates);
};
