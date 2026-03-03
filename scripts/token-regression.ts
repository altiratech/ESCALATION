import { actions, adversaryProfiles, images, scenarios } from '@wargames/content';
import {
  buildCompressedStateSummary,
  estimateTokenCount,
  getBeat,
  initializeGameState,
  serializeCompressedStateSummary,
  buildBeatMap
} from '@wargames/engine';
import type { ActionDefinition } from '@wargames/shared-types';

const budgets = {
  interpretInput: 1000,
  interpretOutput: 250,
  stitchInput: 1200,
  stitchOutput: 500,
  improviseInput: 1400,
  improviseOutput: 600
};

const toleranceMultiplier = 1.1;
const enforceBudget = (name: keyof typeof budgets, value: number): void => {
  const max = Math.round(budgets[name] * toleranceMultiplier);
  if (value > max) {
    throw new Error(`${name} token estimate ${value} exceeds gate ${max} (>10% over budget ${budgets[name]}).`);
  }
};

const scenario = scenarios[0];
const adversaryProfile = adversaryProfiles[0];

if (!scenario || !adversaryProfile) {
  throw new Error('Scenario/adversaryProfile content missing.');
}

const state = initializeGameState('token-regression', 'TOKEN-REGRESSION', {
  scenario,
  adversaryProfile,
  actions,
  images
});

const beat = getBeat(buildBeatMap(scenario), state.currentBeatId);
const css = buildCompressedStateSummary({
  state,
  role: scenario.role,
  adversaryProfile,
  narrativeTokens: []
});
const cssText = serializeCompressedStateSummary(css);

const offeredActions = state.offeredActionIds
  .map((id) => actions.find((action) => action.id === id))
  .filter((action): action is ActionDefinition => Boolean(action));

const actionGlossary = offeredActions
  .map((action) => `${action.id}: ${action.summary}`)
  .join('\n');

const interpretPrompt = [
  'JOB: Interpret',
  `ROLE: ${scenario.role}`,
  'PLAYER INPUT: "Authorize a limited naval escort and signal willingness to talk via neutral intermediaries."',
  `METER SNAPSHOT: ${JSON.stringify(state.meters)}`,
  'AVAILABLE ACTIONS:',
  actionGlossary,
  'Return JSON: { actionId, confidence, modifiers, narrativeGloss }.'
].join('\n');

const stitchPrompt = [
  'JOB: Stitch',
  'Use the provided compressed summary and beat fragments to assemble a coherent briefing.',
  `CSS: ${cssText}`,
  `SCENE FRAGMENTS: ${(beat.sceneFragments ?? []).join(' | ')}`,
  `ADVISOR LINES: ${Object.values(beat.advisorLines).flat().join(' | ')}`,
  `HEADLINES: ${beat.headlines.join(' | ')}`
].join('\n');

const improvisePrompt = [
  'JOB: Improvise',
  `CSS: ${cssText}`,
  'PLAYER CUSTOMIZATION: "Use the Singapore channel and include maritime insurance guarantees in the offer."',
  `BASE ACTION: ${offeredActions[0]?.id ?? 'backchannel_diplomacy'}`,
  'Generate one paragraph grounded in current state only.'
].join('\n');

const counts = {
  interpretInput: estimateTokenCount(interpretPrompt),
  interpretOutput: estimateTokenCount('{"actionId":"backchannel_diplomacy","confidence":0.74,"modifiers":{"allianceTrust":0.1},"narrativeGloss":"..."}'),
  stitchInput: estimateTokenCount(stitchPrompt),
  stitchOutput: estimateTokenCount('A 170-word stitched briefing paragraph with one headline and optional memo/ticker line.'),
  improviseInput: estimateTokenCount(improvisePrompt),
  improviseOutput: estimateTokenCount('A 220-word improvisation paragraph describing the customized action and immediate consequences.')
};

for (const [name, value] of Object.entries(counts) as Array<[keyof typeof counts, number]>) {
  enforceBudget(name, value);
}

const projectedCosts = {
  menuOnly: 7 * 0.0005 + 3 * 0.005,
  mixed: 4 * 0.0003 + 5 * 0.0005 + 3 * 0.005 + 2 * 0.007,
  worstCase: 12 * 0.0003 + 6 * 0.005 + 6 * 0.007
};

if (projectedCosts.worstCase > 0.1) {
  throw new Error(`Worst-case projected per-episode cost ${projectedCosts.worstCase.toFixed(3)} exceeds $0.10 target.`);
}

console.log('Token regression checks passed.');
console.log('Token estimates:', counts);
console.log('Projected per-episode costs:', projectedCosts);
