import { describe, expect, it } from 'vitest';

import { buildBeatProgressId, type BeatProgressPayload } from '../../apps/api/src/repository';

const basePayload: BeatProgressPayload = {
  episodeId: 'episode-123',
  turnNumber: 4,
  beatIdBefore: 'ns_opening',
  beatIdAfter: 'ns_port_incident',
  transitionSource: 'action',
  transitioned: true,
  timerMode: 'standard',
  timerSeconds: 90,
  timerSecondsRemaining: 31,
  timerExpired: false,
  extendUsed: false,
  extendTimerUsesRemaining: 1
};

describe('buildBeatProgressId', () => {
  it('returns a stable id for equivalent analytics events', () => {
    const first = buildBeatProgressId(basePayload);
    const second = buildBeatProgressId({ ...basePayload, timerSecondsRemaining: 15 });

    expect(first).toBe(second);
  });

  it('changes when the transition source changes', () => {
    const actionId = buildBeatProgressId(basePayload);
    const timeoutId = buildBeatProgressId({ ...basePayload, transitionSource: 'timeout' });

    expect(actionId).not.toBe(timeoutId);
  });
});
