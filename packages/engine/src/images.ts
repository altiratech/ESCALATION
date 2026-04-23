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

const visualFamilyKey = (asset: ImageAsset): string => {
  const tags = new Set(asset.tags.map((tag) => tag.toLowerCase()));
  const lowerPerspective = String(asset.perspective).toLowerCase();

  if (tags.has('white_phosphor') || tags.has('night_vision') || tags.has('night_ops')) {
    return 'night-vision';
  }
  if (tags.has('thermal')) {
    return 'thermal';
  }
  if (tags.has('satellite') || lowerPerspective === 'satellite' || asset.kind === 'map') {
    return 'satellite';
  }
  if (lowerPerspective === 'surveillance' || asset.kind === 'artifact') {
    return 'surveillance';
  }
  if (tags.has('command_center') || tags.has('watchfloor') || tags.has('cic')) {
    return 'watchfloor';
  }
  if (tags.has('boarding') || tags.has('coast_guard')) {
    return 'boarding';
  }
  if (tags.has('queue') || tags.has('blockade') || tags.has('shipping')) {
    return 'shipping-lane';
  }
  if (tags.has('harbor') || tags.has('port') || tags.has('false_relief')) {
    return 'harbor';
  }
  if (tags.has('spr') || tags.has('energy') || tags.has('reserves') || tags.has('stockpiles')) {
    return 'energy-logistics';
  }

  return `${asset.kind}:${lowerPerspective}`;
};

const buildBeatTags = (beat: BeatNode | undefined): string[] =>
  normalizedTags([...(beat?.imageHints ?? []), ...(beat?.visualCue?.tags ?? []), ...stageFromPhase(beat)]);

const buildActionTags = (action?: ActionDefinition | null): string[] => normalizedTags([...(action?.visualTags ?? [])]);

const buildVariantTags = (variant?: ActionVariantDefinition | null): string[] =>
  normalizedTags([...(variant?.visualTags ?? [])]);

const rankedCuratedAssets = (
  ranked: Array<{ asset: ImageAsset; score: number }>,
  ids: string[] | undefined
): Array<{ asset: ImageAsset; score: number }> => {
  if (!ids || ids.length === 0) {
    return [];
  }

  const rankedById = new Map(ranked.map((entry) => [entry.asset.id, entry]));
  return ids
    .map((id) => rankedById.get(id))
    .filter((entry): entry is { asset: ImageAsset; score: number } => Boolean(entry));
};

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

const countTagMatches = (asset: ImageAsset, requestedTags: string[]): number => {
  const assetTags = new Set(asset.tags.map((tag) => tag.toLowerCase()));
  return requestedTags.reduce((count, tag) => count + (assetTags.has(tag) ? 1 : 0), 0);
};

const scoreAssetRealism = (asset: ImageAsset): number => {
  if (asset.id.startsWith('img_')) {
    return -10;
  }

  const lowerPath = asset.path.toLowerCase();
  if (lowerPath.endsWith('.svg')) {
    return -18;
  }

  if (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg') || lowerPath.endsWith('.png') || lowerPath.endsWith('.webp')) {
    return 8;
  }

  if (asset.kind === 'map' || asset.kind === 'artifact') {
    return 0;
  }

  return 0;
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
  const beatMatchCount = countTagMatches(asset, beatTags);
  const actionMatchCount = countTagMatches(asset, actionTags);
  const variantMatchCount = countTagMatches(asset, variantTags);

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
  score += scoreAssetRealism(asset);
  score += actionMatchCount > 0 ? 6 : 0;
  score += variantMatchCount > 0 ? 8 : 0;

  if (beatTags.length > 0 && beatMatchCount === 0) {
    score -= 6;
  }
  if (actionTags.length > 0 && actionMatchCount === 0) {
    score -= 8;
  }
  if (variantTags.length > 0 && variantMatchCount === 0) {
    score -= 10;
  }

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
  const recentFamilies = new Set(
    recentImageIds
      .map((id) => assets.find((asset) => asset.id === id))
      .filter((asset): asset is ImageAsset => Boolean(asset))
      .map((asset) => visualFamilyKey(asset))
  );

  const available = assets.filter((asset) => !recentImageIds.includes(asset.id));
  const scoredAll = assets
    .map((asset) => ({
      asset,
      score:
        scoreAsset(asset, scenario, dominantDomain, severity, preferredKinds, beatTags, actionTags, variantTags) -
        (recentFamilies.has(visualFamilyKey(asset)) ? 10 : 0)
    }))
    .sort((left, right) => right.score - left.score || left.asset.id.localeCompare(right.asset.id));
  const scored = (available.length > 0 ? available : assets)
    .map((asset) => ({
      asset,
      score:
        scoreAsset(asset, scenario, dominantDomain, severity, preferredKinds, beatTags, actionTags, variantTags) -
        (recentFamilies.has(visualFamilyKey(asset)) ? 10 : 0)
    }))
    .sort((left, right) => right.score - left.score || left.asset.id.localeCompare(right.asset.id));

  const curatedHero = rankedCuratedAssets(scoredAll, beat?.visualCue?.heroImageIds);
  if (curatedHero.length > 0) {
    return curatedHero[0]?.asset ?? null;
  }

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

export const chooseImageGallery = (
  options: ChooseImageAssetOptions,
  count = 3
): ImageAsset[] => {
  if (count <= 0 || options.assets.length === 0) {
    return [];
  }

  const dominantDomain = classifyDomain(options.turnDelta);
  const severity = classifySeverity(options.meters);
  const preferredKinds = options.beat?.visualCue?.preferredKinds?.length
    ? options.beat.visualCue.preferredKinds
    : kindPreferenceFallback;
  const beatTags = buildBeatTags(options.beat);
  const actionTags = buildActionTags(options.playerAction);
  const variantTags = buildVariantTags(options.playerVariant);
  const available = options.assets.filter((asset) => !options.recentImageIds.includes(asset.id));
  const recentFamilies = new Set(
    options.recentImageIds
      .map((id) => options.assets.find((asset) => asset.id === id))
      .filter((asset): asset is ImageAsset => Boolean(asset))
      .map((asset) => visualFamilyKey(asset))
  );

  const rankedAll = options.assets
    .map((asset) => ({
      asset,
      score: scoreAsset(
        asset,
        options.scenario,
        dominantDomain,
        severity,
        preferredKinds,
        beatTags,
        actionTags,
        variantTags
      ) - (recentFamilies.has(visualFamilyKey(asset)) ? 10 : 0)
    }))
    .sort((left, right) => right.score - left.score || left.asset.id.localeCompare(right.asset.id));
  const ranked = (available.length > 0 ? available : options.assets)
    .map((asset) => ({
      asset,
      score: scoreAsset(
        asset,
        options.scenario,
        dominantDomain,
        severity,
        preferredKinds,
        beatTags,
        actionTags,
        variantTags
      ) - (recentFamilies.has(visualFamilyKey(asset)) ? 10 : 0)
    }))
    .sort((left, right) => right.score - left.score || left.asset.id.localeCompare(right.asset.id));

  const selected: ImageAsset[] = [];
  const usedKinds = new Set<ImageAssetKind>();
  const usedPerspectives = new Set<ImageAsset['perspective']>();
  const usedFamilies = new Set<string>();
  const hasCuratedGallery =
    (options.beat?.visualCue?.heroImageIds?.length ?? 0) > 0 ||
    (options.beat?.visualCue?.evidenceImageIds?.length ?? 0) > 0;

  const curatedHero = rankedCuratedAssets(rankedAll, options.beat?.visualCue?.heroImageIds);
  if (curatedHero.length > 0) {
    selected.push(curatedHero[0]!.asset);
    usedKinds.add(curatedHero[0]!.asset.kind);
    usedPerspectives.add(curatedHero[0]!.asset.perspective);
    usedFamilies.add(visualFamilyKey(curatedHero[0]!.asset));
  }

  const curatedEvidence = rankedCuratedAssets(rankedAll, options.beat?.visualCue?.evidenceImageIds)
    .filter((entry) => !selected.some((asset) => asset.id === entry.asset.id));

  for (const { asset } of curatedEvidence) {
    if (selected.length >= count) {
      break;
    }

    const family = visualFamilyKey(asset);
    if (usedFamilies.has(family)) {
      continue;
    }

    selected.push(asset);
    usedKinds.add(asset.kind);
    usedPerspectives.add(asset.perspective);
    usedFamilies.add(family);
  }

  if (hasCuratedGallery && selected.length > 0) {
    return selected.slice(0, count);
  }

  for (const { asset } of ranked) {
    if (selected.length >= count) {
      break;
    }

    const beatMatchCount = countTagMatches(asset, beatTags);
    const actionMatchCount = countTagMatches(asset, actionTags);
    const variantMatchCount = countTagMatches(asset, variantTags);

    if (selected.length > 0 && beatMatchCount < 2 && actionMatchCount === 0 && variantMatchCount === 0) {
      continue;
    }

    const sameKindPenalty = usedKinds.has(asset.kind) ? 3 : 0;
    const samePerspectivePenalty = usedPerspectives.has(asset.perspective) ? 2 : 0;
    const sameFamilyPenalty = usedFamilies.has(visualFamilyKey(asset)) ? 8 : 0;
    const adjustedScore = ranked.find((entry) => entry.asset.id === asset.id)?.score ?? 0;
    if (selected.length > 0 && adjustedScore - sameKindPenalty - samePerspectivePenalty - sameFamilyPenalty < 4) {
      continue;
    }

    selected.push(asset);
    usedKinds.add(asset.kind);
    usedPerspectives.add(asset.perspective);
    usedFamilies.add(visualFamilyKey(asset));
  }

  return selected;
};
