import {
  actions,
  adversaryProfiles,
  debriefDeep,
  images,
  scenarios
} from '@wargames/content';
import {
  buildActionMap,
  initializeGameState,
  resolveTurn,
  selectPlayerActionOptions,
  SeededRng
} from '@wargames/engine';
import type {
  ActionDefinition,
  ActionVariantDefinition,
  BeatNode,
  GameState,
  ScenarioDefinition
} from '@wargames/shared-types';

interface CombinationResult {
  actionId: string;
  variantId: string | null;
  beatAfter: string;
  imageId: string | null;
  galleryKey: string;
}

const requestedScenarioId = process.argv.find((arg) => arg.startsWith('--scenario='))?.split('=')[1];
const scenario = scenarios.find((entry) =>
  requestedScenarioId ? entry.id === requestedScenarioId : !entry.isLegacy
);

if (!scenario) {
  throw new Error(`Scenario not found${requestedScenarioId ? `: ${requestedScenarioId}` : ''}`);
}

const adversaryProfile = adversaryProfiles.find((entry) => entry.id === scenario.adversaryProfileId);
if (!adversaryProfile) {
  throw new Error(`Adversary profile not found: ${scenario.adversaryProfileId}`);
}

const actionMap = buildActionMap(actions);
const actionById = new Map(actions.map((action) => [action.id, action]));
const imageById = new Map(images.map((image) => [image.id, image]));

const cloneState = (state: GameState): GameState => JSON.parse(JSON.stringify(state)) as GameState;

const nonTerminalBeats = scenario.beats.filter((beat) => beat.terminalOutcome === null);

const buildStateAtBeat = (beat: BeatNode, turn: number): GameState => {
  const state = initializeGameState(
    `diagnostic:${scenario.id}:${beat.id}`,
    `diagnostic:${scenario.id}:${beat.id}`,
    {
      scenario,
      adversaryProfile,
      actions,
      images,
      debriefVariants: debriefDeep?.variants
    },
    { timerMode: 'off' }
  );

  state.turn = Math.min(Math.max(1, turn), scenario.maxTurns);
  state.status = 'active';
  state.outcome = null;
  state.currentBeatId = beat.id;
  state.beatHistory = [scenario.startingBeatId, beat.id].filter((value, index, array) => array.indexOf(value) === index);
  state.history = [];
  state.recentImageIds = [];
  state.turnDebrief = null;
  state.activeCountdown = null;
  state.offeredActionIds = selectPlayerActionOptions(
    state,
    scenario,
    actionMap,
    new SeededRng(`diagnostic-options:${scenario.id}:${beat.id}:${turn}`)
  );

  return state;
};

const variantsForAction = (action: ActionDefinition): Array<ActionVariantDefinition | null> => {
  if (!action.variants || action.variants.length === 0) {
    return [null];
  }
  return action.variants;
};

const imageLabel = (imageId: string | null): string => {
  if (!imageId) {
    return 'none';
  }
  const image = imageById.get(imageId);
  return image ? `${image.id}:${image.kind}:${image.perspective}` : imageId;
};

const summarizeBeat = (beat: BeatNode, turn: number): void => {
  const baseState = buildStateAtBeat(beat, turn);
  const results: CombinationResult[] = [];
  const errors: string[] = [];

  for (const actionId of baseState.offeredActionIds) {
    const action = actionById.get(actionId);
    if (!action) {
      errors.push(`${actionId}: action missing`);
      continue;
    }

    for (const variant of variantsForAction(action)) {
      try {
        const { resolution } = resolveTurn(
          cloneState(baseState),
          action.id,
          {
            scenario,
            adversaryProfile,
            actions,
            images,
            debriefVariants: debriefDeep?.variants
          },
          {
            playerVariantId: variant?.id ?? null,
            nowMs: 0
          }
        );

        const gallery = [
          resolution.selectedImageId,
          ...resolution.selectedSupportingImageIds
        ].filter((entry): entry is string => Boolean(entry));

        results.push({
          actionId: action.id,
          variantId: variant?.id ?? null,
          beatAfter: resolution.beatIdAfter,
          imageId: resolution.selectedImageId,
          galleryKey: gallery.join('>') || 'none'
        });
      } catch (error) {
        errors.push(`${action.id}${variant ? `/${variant.id}` : ''}: ${(error as Error).message}`);
      }
    }
  }

  const distinctBeats = new Set(results.map((entry) => entry.beatAfter));
  const distinctHeroImages = new Set(results.map((entry) => entry.imageId ?? 'none'));
  const distinctGalleries = new Set(results.map((entry) => entry.galleryKey));
  const repeatedHeroImages = [...distinctHeroImages]
    .map((imageId) => ({
      imageId,
      count: results.filter((entry) => (entry.imageId ?? 'none') === imageId).length
    }))
    .filter((entry) => entry.count > 1)
    .sort((left, right) => right.count - left.count);

  const warningReasons = [
    distinctBeats.size <= 1 ? 'single_next_beat' : null,
    distinctHeroImages.size <= 1 ? 'single_hero_image' : null,
    distinctGalleries.size <= 1 ? 'single_gallery' : null
  ].filter((entry): entry is string => Boolean(entry));

  console.log(`\nBeat ${beat.id} (${beat.phase}, diagnostic turn ${baseState.turn})`);
  console.log(`  offeredActions=${baseState.offeredActionIds.join(', ')}`);
  console.log(`  combinations=${results.length} distinctNextBeats=${distinctBeats.size} distinctHeroImages=${distinctHeroImages.size} distinctGalleries=${distinctGalleries.size}`);

  if (warningReasons.length > 0) {
    console.log(`  warning=${warningReasons.join(',')}`);
  }

  for (const image of repeatedHeroImages.slice(0, 3)) {
    console.log(`  repeatedHero=${imageLabel(image.imageId === 'none' ? null : image.imageId)} count=${image.count}`);
  }

  const sampleByBeat = new Map<string, CombinationResult>();
  for (const result of results) {
    if (!sampleByBeat.has(result.beatAfter)) {
      sampleByBeat.set(result.beatAfter, result);
    }
  }
  for (const sample of sampleByBeat.values()) {
    const variant = sample.variantId ? `/${sample.variantId}` : '';
    console.log(`  sample ${sample.actionId}${variant} -> ${sample.beatAfter} | ${imageLabel(sample.imageId)}`);
  }

  for (const error of errors) {
    console.log(`  error=${error}`);
  }
};

console.log(`Decision/visual diagnostics for ${scenario.id}`);
console.log(`Non-terminal beats: ${nonTerminalBeats.length}`);

nonTerminalBeats.forEach((beat, index) => summarizeBeat(beat, index + 1));
