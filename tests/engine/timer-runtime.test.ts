import { describe, expect, it } from 'vitest';

import { actions, archetypes, images, scenarios } from '@wargames/content';
import { extendActiveCountdown, initializeGameState, resolveInactionTurn, resolveTurn } from '@wargames/engine';

const scenario = scenarios[0];
const archetype = archetypes[0];

describe('timer runtime behavior', () => {
  it('extends active countdown once per beat and decrements episode allowance', () => {
    if (!scenario || !archetype) {
      throw new Error('Test content unavailable');
    }

    const state = initializeGameState('timer-extend', 'TIMER-EXTEND', {
      scenario,
      archetype,
      actions,
      images
    });

    const now = 2_000_000;
    state.currentBeatId = 'ns_missile_warning';
    state.activeCountdown = {
      beatId: 'ns_missile_warning',
      seconds: 75,
      secondsRemaining: 52,
      expiresAt: now + 52_000,
      inactionBeatId: 'ns_open_war',
      inactionDeltas: {
        escalationIndex: 18
      },
      inactionNarrative: 'Timer expired.',
      extendsUsed: 0
    };
    state.extendTimerUsesRemaining = 2;
    state.timerMode = 'standard';

    const extended = extendActiveCountdown(state, now);
    expect(extended.extendTimerUsesRemaining).toBe(1);
    expect(extended.activeCountdown?.extendsUsed).toBe(1);
    expect(extended.activeCountdown?.seconds).toBe(113);
    expect(extended.activeCountdown?.secondsRemaining).toBe(90);
    expect(extended.activeCountdown?.expiresAt).toBe(now + 90_000);

    expect(() => extendActiveCountdown(extended, now)).toThrow('already used');
  });

  it('resolves timeout into authored inaction branch', () => {
    if (!scenario || !archetype) {
      throw new Error('Test content unavailable');
    }

    const state = initializeGameState('timer-timeout', 'TIMER-TIMEOUT', {
      scenario,
      archetype,
      actions,
      images
    });

    const now = 3_000_000;
    state.currentBeatId = 'ns_missile_warning';
    state.turn = 7;
    state.activeCountdown = {
      beatId: 'ns_missile_warning',
      seconds: 75,
      secondsRemaining: 0,
      expiresAt: now - 1_000,
      inactionBeatId: 'ns_open_war',
      inactionDeltas: {
        escalationIndex: 18,
        militaryReadiness: -8,
        allianceTrust: -12
      },
      inactionNarrative: 'No directive issued during launch-warning window.',
      extendsUsed: 0
    };

    const escalationBefore = state.meters.escalationIndex;

    const { nextState, resolution } = resolveInactionTurn(state, {
      scenario,
      archetype,
      actions,
      images
    }, {
      source: 'timeout',
      now
    });

    expect(nextState.currentBeatId).toBe('ns_open_war');
    expect(nextState.meters.escalationIndex).toBeGreaterThan(escalationBefore);
    expect(resolution.playerActionId).toBe('__no_action__');
    expect(resolution.turnDebrief.lines[0]?.tag).toBe('PlayerAction');
  });

  it('supports explicit Take No Action path when timer mode is off', () => {
    if (!scenario || !archetype) {
      throw new Error('Test content unavailable');
    }

    const state = initializeGameState('timer-off', 'TIMER-OFF', {
      scenario,
      archetype,
      actions,
      images
    }, { timerMode: 'off' });

    state.currentBeatId = 'ns_missile_warning';
    state.turn = 7;
    state.activeCountdown = null;

    const { nextState } = resolveInactionTurn(state, {
      scenario,
      archetype,
      actions,
      images
    }, {
      source: 'explicit',
      now: 4_000_000
    });

    expect(nextState.currentBeatId).toBe('ns_open_war');
    expect(nextState.activeCountdown).toBeNull();
  });

  it('starts countdown when gameplay transitions into a timed beat', () => {
    if (!scenario || !archetype) {
      throw new Error('Test content unavailable');
    }

    const state = initializeGameState('timer-transition', 'TIMER-TRANSITION', {
      scenario,
      archetype,
      actions,
      images
    });

    state.currentBeatId = 'ns_alliance_split';
    state.turn = 7;
    state.timerMode = 'standard';
    state.activeCountdown = null;
    state.meters.escalationIndex = 0;
    state.meters.allianceTrust = 100;
    state.meters.economicStability = 100;

    const selectedActionId = state.offeredActionIds[0];
    if (!selectedActionId) {
      throw new Error('Expected at least one offered action');
    }

    const { nextState } = resolveTurn(state, selectedActionId, {
      scenario,
      archetype,
      actions,
      images
    });

    expect(nextState.currentBeatId).toBe('ns_crisis_window');
    expect(nextState.activeCountdown).not.toBeNull();
    expect(nextState.activeCountdown?.beatId).toBe('ns_crisis_window');
    expect(nextState.activeCountdown?.seconds).toBe(90);
  });

  it('preserves countdown on same-beat turns inside timed beats', () => {
    if (!scenario || !archetype) {
      throw new Error('Test content unavailable');
    }

    const state = initializeGameState('timer-same-beat', 'TIMER-SAME-BEAT', {
      scenario,
      archetype,
      actions,
      images
    });

    state.currentBeatId = 'ns_crisis_window';
    state.turn = 7;
    state.timerMode = 'standard';
    state.activeCountdown = {
      beatId: 'ns_crisis_window',
      seconds: 90,
      secondsRemaining: 40,
      expiresAt: 5_040_000,
      inactionBeatId: 'ns_carrier_faceoff',
      inactionDeltas: {
        escalationIndex: 12
      },
      inactionNarrative: 'Window expired.',
      extendsUsed: 0
    };
    state.meters.escalationIndex = 0;
    state.meters.militaryReadiness = 0;
    state.meters.allianceTrust = 0;

    const selectedAction = actions.find((action) => action.actor === 'player');
    if (!selectedAction) {
      throw new Error('Expected at least one player action');
    }

    state.offeredActionIds = [selectedAction.id];

    const { nextState } = resolveTurn(state, selectedAction.id, {
      scenario,
      archetype,
      actions,
      images
    }, 5_000_000);

    expect(nextState.currentBeatId).toBe('ns_crisis_window');
    expect(nextState.activeCountdown).not.toBeNull();
    expect(nextState.activeCountdown?.beatId).toBe('ns_crisis_window');
    expect(nextState.activeCountdown?.expiresAt).toBe(5_040_000);
    expect(nextState.activeCountdown?.secondsRemaining).toBe(40);
  });
});
