import { describe, expect, it } from 'vitest';

import { actions, archetypes, images, scenarios } from '@wargames/content';
import { initializeGameState, resolveTurn } from '@wargames/engine';

const scenario = scenarios[0];
const archetype = archetypes[0];

describe('deterministic seed mode', () => {
  it('replays identical outcome with same seed and choices', () => {
    if (!scenario || !archetype) {
      throw new Error('Test data unavailable');
    }

    const run = (): { trace: number[]; outcome: string | null } => {
      let state = initializeGameState('episode-test', 'SEED-ALPHA', {
        scenario,
        archetype,
        actions,
        images
      });

      const trace: number[] = [];
      for (let turn = 0; turn < 6 && state.status === 'active'; turn += 1) {
        const selected = state.offeredActionIds[0] as string;
        const { nextState, resolution } = resolveTurn(state, selected, {
          scenario,
          archetype,
          actions,
          images
        });
        trace.push(...resolution.rngTrace);
        state = nextState;
      }

      return {
        trace,
        outcome: state.outcome
      };
    };

    const first = run();
    const second = run();

    expect(first.outcome).toEqual(second.outcome);
    expect(first.trace).toEqual(second.trace);
  });
});
