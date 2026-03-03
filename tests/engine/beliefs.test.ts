import { describe, expect, it } from 'vitest';

import { actions, adversaryProfiles, images, scenarios } from '@wargames/content';
import { initializeGameState, SeededRng, updateBeliefs } from '@wargames/engine';

const scenario = scenarios[0];
const adversaryProfile = adversaryProfiles[2];

describe('rival belief updates', () => {
  it('increases humiliation after high-visibility provocative action', () => {
    if (!scenario || !adversaryProfile) {
      throw new Error('Test data unavailable');
    }

    const state = initializeGameState('belief-episode', 'SEED-BELIEF', {
      scenario,
      adversaryProfile,
      actions,
      images
    });

    const provocativeAction = actions.find((entry) => entry.id === 'military_posture_increase');
    if (!provocativeAction) {
      throw new Error('Action missing');
    }

    const rng = new SeededRng(state.rngState);
    const before = { ...state.beliefs };
    const after = updateBeliefs(before, provocativeAction, state, adversaryProfile, rng);

    expect(after.humiliation).toBeGreaterThan(before.humiliation);
    expect(after.thresholdHighProb).toBeLessThanOrEqual(1);
    expect(after.bluffProb).toBeGreaterThanOrEqual(0);
  });
});
