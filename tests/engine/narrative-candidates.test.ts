import { describe, expect, it } from 'vitest';

import { getPressureText, scenarios } from '@wargames/content';

describe('narrative candidate helpers', () => {
  it('selects beat-specific pressure text by threshold and falls back to generic', () => {
    const crisisLine = getPressureText('ns_crisis_window', 14);
    const fallbackLine = getPressureText('unknown_future_beat', 9);

    expect(crisisLine).toBeTruthy();
    expect(crisisLine?.toLowerCase()).toContain('fifteen seconds');
    expect(fallbackLine).toBeTruthy();
    expect(fallbackLine?.toLowerCase()).toContain('ten seconds');
  });

  it('merges pack-level advisor lines with scenario-authored beat lines without duplicates', () => {
    const openingBeat = scenarios[0]?.beats.find((beat) => beat.id === 'ns_opening_signal');

    if (!openingBeat) {
      throw new Error('Expected ns_opening_signal beat in scenario content');
    }

    expect(openingBeat.advisorLines.reed).toBeTruthy();
    expect(openingBeat.advisorLines.reed.length).toBeGreaterThan(0);
    expect(openingBeat.advisorLines.cross.length).toBeGreaterThanOrEqual(2);
    expect(new Set(openingBeat.advisorLines.cross).size).toBe(openingBeat.advisorLines.cross.length);
  });
});
