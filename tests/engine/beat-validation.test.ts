import { describe, expect, it } from 'vitest';

import { scenarios } from '@wargames/content';
import { analyzeBeatGraph } from '@wargames/engine';

describe('beat graph validation', () => {
  it('passes structural integrity checks for authored scenario', () => {
    const scenario = scenarios[0];
    if (!scenario) {
      throw new Error('Scenario unavailable');
    }

    const analysis = analyzeBeatGraph(scenario);
    const errors = analysis.issues.filter((issue) => issue.level === 'error');

    expect(errors).toHaveLength(0);
    expect(analysis.unreachableBeatIds).toHaveLength(0);
    expect(analysis.beatsWithoutTerminalPath).toHaveLength(0);
    expect(analysis.terminalBeatIds.length).toBeGreaterThan(0);
  });
});
