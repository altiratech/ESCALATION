import { describe, expect, it } from 'vitest';

import { actions, adversaryProfiles, images, scenarios } from '@wargames/content';
import { initializeGameState, traverseBeatGraph } from '@wargames/engine';

const scenario = scenarios[0];
const adversaryProfile = adversaryProfiles[0];

describe('beat traversal', () => {
  it('transitions to escalation beat when threshold branch conditions are met', () => {
    if (!scenario || !adversaryProfile) {
      throw new Error('Test content unavailable');
    }

    const state = initializeGameState('beat-threshold', 'BEAT-THRESHOLD', {
      scenario,
      adversaryProfile,
      actions,
      images
    });

    state.turn = 2;
    state.meters.escalationIndex = 61;

    const playerAction = actions.find((entry) => entry.id === 'military_posture_increase');
    if (!playerAction) {
      throw new Error('Test action missing');
    }

    const result = traverseBeatGraph(state, scenario, playerAction);
    expect(result.transitioned).toBe(true);
    expect(result.beatIdAfter).toBe('ns_strait_pressure');
  });

  it('uses fallback branch when no gated branch conditions pass', () => {
    if (!scenario || !adversaryProfile) {
      throw new Error('Test content unavailable');
    }

    const state = initializeGameState('beat-fallback', 'BEAT-FALLBACK', {
      scenario,
      adversaryProfile,
      actions,
      images
    });

    state.turn = 3;
    state.meters.escalationIndex = 40;
    state.meters.allianceTrust = 60;

    const playerAction = actions.find((entry) => entry.id === 'backchannel_diplomacy');
    if (!playerAction) {
      throw new Error('Test action missing');
    }

    const result = traverseBeatGraph(state, scenario, playerAction);
    expect(result.transitioned).toBe(true);
    expect(result.beatIdAfter).toBe('ns_backchannel_opening');
  });

  it('returns terminal outcome when traversal enters terminal beat', () => {
    if (!scenario || !adversaryProfile) {
      throw new Error('Test content unavailable');
    }

    const state = initializeGameState('beat-terminal', 'BEAT-TERMINAL', {
      scenario,
      adversaryProfile,
      actions,
      images
    });

    state.currentBeatId = 'ns_carrier_faceoff';
    state.beatHistory = ['ns_opening_signal', 'ns_strait_pressure', 'ns_carrier_faceoff'];
    state.turn = 8;
    state.meters.escalationIndex = 90;
    state.meters.militaryReadiness = 70;
    state.meters.allianceTrust = 30;

    const playerAction = actions.find((entry) => entry.id === 'military_posture_increase');
    if (!playerAction) {
      throw new Error('Test action missing');
    }

    const result = traverseBeatGraph(state, scenario, playerAction);
    expect(result.beatIdAfter).toBe('ns_open_war');
    expect(result.terminalOutcome).toBe('war');
  });
});
