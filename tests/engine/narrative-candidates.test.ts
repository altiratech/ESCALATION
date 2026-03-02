import { describe, expect, it } from 'vitest';

import { getPressureText } from '@wargames/content';

describe('narrative candidate helpers', () => {
  it('selects beat-specific pressure text by threshold and falls back to generic', () => {
    const crisisLine = getPressureText('ns_crisis_window', 14);
    const fallbackLine = getPressureText('unknown_future_beat', 9);

    expect(crisisLine).toBeTruthy();
    expect(crisisLine?.toLowerCase()).toContain('decision horizon');
    expect(fallbackLine).toBeTruthy();
    expect(fallbackLine?.toLowerCase()).toContain('critical seconds');
  });
});
