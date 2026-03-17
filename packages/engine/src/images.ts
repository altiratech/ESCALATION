import type {
  ActionDefinition,
  ActionVariantDefinition,
  BeatNode,
  ImageAsset,
  ImageAssetKind,
  MeterState,
  ScenarioDefinition
} from '@wargames/shared-types';

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

const kindPreferenceFallback: ImageAssetKind[] = ['scenario_still', 'artifact', 'documentary_still', 'map'];

const stageFromPhase = (beat: BeatNode | undefined): string[] => {
  if (!beat) {
    return [];
  }

  const phaseMap: Record<BeatNode['phase'], string[]> = {
    opening: ['ambiguous'],
    rising: ['compression', 'coercion'],
    crisis: ['incident', 'false_relief'],
    climax: ['tail_risk', 'collapse'],
    resolution: ['collapse']
  };

  const fromCue = beat.visualCue?.branchStage ? [beat.visualCue.branchStage] : [];
  return [...new Set([...fromCue, ...(phaseMap[beat.phase] ?? [])])];
};

const normalizedTags = (tags: string[]): string[] => [...new Set(tags.map((tag) => tag.toLowerCase()))];

const buildBeatTags = (beat: BeatNode | undefined): string[] =>
  normalizedTags([...(beat?.imageHints ?? []), ...(beat?.visualCue?.tags ?? []), ...stageFromPhase(beat)]);

const buildActionTags = (action?: ActionDefinition | null): string[] => normalizedTags([...(action?.visualTags ?? [])]);

const buildVariantTags = (variant?: ActionVariantDefinition | null): string[] =>
  normalizedTags([...(variant?.visualTags ?? [])]);

const scoreKind = (asset: ImageAsset, preferredKinds: ImageAssetKind[]): number => {
  const index = preferredKinds.indexOf(asset.kind);
  if (index === -1) {
    return 0;
  }
  return Math.max(1, preferredKinds.length - index) * 6;
};

const scoreTags = (asset: ImageAsset, requestedTags: string[], weight = 4): number => {
  const assetTags = new Set(asset.tags.map((tag) => tag.toLowerCase()));
  return requestedTags.reduce((score, tag) => score + (assetTags.has(tag) ? weight : 0), 0);
};

const scoreAsset = (
  asset: ImageAsset,
  scenario: ScenarioDefinition,
  dominantDomain: ImageAsset['domain'],
  severity: ImageAsset['severity'],
  preferredKinds: ImageAssetKind[],
  beatTags: string[],
  actionTags: string[],
  variantTags: string[]
): number => {
  let score = 0;

  if (asset.environment === scenario.environment) {
    score += 8;
  } else if (asset.environment === 'generic') {
    score += 4;
  } else {
    score -= 4;
  }

  if (asset.domain === dominantDomain) {
    score += 7;
  } else if (asset.domain === 'diplomacy' && dominantDomain !== 'military') {
    score += 2;
  }

  score += Math.max(0, 4 - Math.abs(asset.severity - severity)) * 2;
  score += scoreKind(asset, preferredKinds);
  score += scoreTags(asset, beatTags, 4);
  score += scoreTags(asset, actionTags, 6);
  score += scoreTags(asset, variantTags, 8);

  if (asset.kind === 'map' && !beatTags.includes('map') && preferredKinds[0] !== 'map') {
    score -= 6;
  }

  return score;
};

interface ChooseImageAssetOptions {
  assets: ImageAsset[];
  scenario: ScenarioDefinition;
  beat?: BeatNode;
  meters: MeterState;
  turnDelta: Partial<MeterState>;
  recentImageIds: string[];
  rng: SeededRng;
  playerAction?: ActionDefinition | null;
  playerVariant?: ActionVariantDefinition | null;
}

export const chooseImageAsset = ({
  assets,
  scenario,
  beat,
  meters,
  turnDelta,
  recentImageIds,
  rng: _rng,
  playerAction,
  playerVariant
}: ChooseImageAssetOptions): ImageAsset | null => {
  if (assets.length === 0) {
    return null;
  }

  const dominantDomain = classifyDomain(turnDelta);
  const severity = classifySeverity(meters);
  const preferredKinds = beat?.visualCue?.preferredKinds?.length
    ? beat.visualCue.preferredKinds
    : kindPreferenceFallback;
  const beatTags = buildBeatTags(beat);
  const actionTags = buildActionTags(playerAction);
  const variantTags = buildVariantTags(playerVariant);
  const requestedTags = normalizedTags([...beatTags, ...actionTags, ...variantTags]);

  const scored = assets
    .filter((asset) => !recentImageIds.includes(asset.id))
    .map((asset) => ({
      asset,
      score: scoreAsset(asset, scenario, dominantDomain, severity, preferredKinds, beatTags, actionTags, variantTags)
    }))
    .sort((left, right) => right.score - left.score);

  const bestScore = scored[0]?.score ?? Number.NEGATIVE_INFINITY;
  const shortlisted = scored.filter((entry) => entry.score >= bestScore - 2);

  if (shortlisted.length > 0 && bestScore > 0) {
    return shortlisted[0]?.asset ?? null;
  }

  const fallback = assets
    .filter((asset) => !recentImageIds.includes(asset.id))
    .sort((left, right) => scoreTags(right, requestedTags) - scoreTags(left, requestedTags));

  return fallback[0] ?? assets[0] ?? null;
};
