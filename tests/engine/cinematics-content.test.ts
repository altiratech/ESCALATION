import { describe, expect, it } from 'vitest';

import { getCinematics, scenarios } from '@wargames/content';

describe('cinematics content helpers', () => {
  it('returns authored opening, transition, and ending cinematics for the scenario', () => {
    const scenario = scenarios[0];

    if (!scenario) {
      throw new Error('Scenario unavailable');
    }

    const cinematics = getCinematics(scenario.id);

    expect(cinematics?.openingCinematic.title).toBe('Flashpoint');
    expect(cinematics?.phaseTransitions.opening_to_rising?.fragments.length).toBeGreaterThan(0);
    expect(cinematics?.endings.stabilization?.title).toBe('The Compromise');
  });
});
