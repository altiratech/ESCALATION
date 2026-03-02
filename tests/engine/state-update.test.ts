import { describe, expect, it } from 'vitest';

import { actions, archetypes, images, scenarios } from '@wargames/content';
import { applyActionToState, applyDueDelayedEffects, initializeGameState, SeededRng } from '@wargames/engine';

const scenario = scenarios[0];
const archetype = archetypes[0];

describe('state update mechanics', () => {
  it('queues and applies delayed effects on scheduled turn', () => {
    if (!scenario || !archetype) {
      throw new Error('Test data unavailable');
    }

    const state = initializeGameState('episode-delay', 'SEED-DELAY', {
      scenario,
      archetype,
      actions,
      images
    });

    const action = actions.find((entry) => entry.id === 'targeted_sanctions');
    if (!action) {
      throw new Error('Action missing');
    }

    const rng = new SeededRng(state.rngState);
    applyActionToState(state, action, 'player', rng, 1);

    expect(state.delayedQueue.length).toBeGreaterThan(0);

    const trustBefore = state.meters.allianceTrust;

    state.turn += 2;
    const delayedDescriptions = applyDueDelayedEffects(state, rng, 1);

    expect(delayedDescriptions.length).toBeGreaterThan(0);
    expect(state.meters.allianceTrust).toBeGreaterThanOrEqual(trustBefore - 4);
  });
});
