import { describe, expect, it } from 'vitest';

import { getScenario, actions } from '@wargames/content';
import { initializeGameState } from '@wargames/engine';

import { interpretCommand } from '../../apps/api/src/interpret';

describe('interpretCommand', () => {
  const scenario = getScenario('northern_strait_black_swan');
  const offered = scenario.availablePlayerActionIds
    .map((actionId) => actions.find((entry) => entry.id === actionId))
    .filter((entry): entry is (typeof actions)[number] => Boolean(entry));
  const initialState = initializeGameState('episode-test', 'seed-test', {
    scenario,
    adversaryProfile: {
      id: 'test-profile',
      name: 'Test Adversary',
      description: 'Test',
      riskTolerance: 0.5,
      escalationThreshold: 0.5,
      covertPreference: 0.5,
      egoSensitivity: 0.5,
      bluffSensitivity: 0.5,
      priorities: {
        preserveEconomy: 0.5,
        preserveRegimeStability: 0.5,
        preserveImage: 0.5,
        projectStrength: 0.5,
        avoidAllianceBreak: 0.5
      }
    },
    actions,
    images: []
  });
  const currentBeat = scenario.beats.find((beat) => beat.id === initialState.currentBeatId) ?? null;

  it('executes on exact action id', () => {
    const action = offered[0];
    if (!action) {
      throw new Error('Test requires at least one offered action');
    }

    const result = interpretCommand(action.id, offered);
    expect(result.decision).toBe('execute');
    expect(result.interpretedActionId).toBe(action.id);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('executes on exact action name', () => {
    const action = offered[1];
    if (!action) {
      throw new Error('Test requires at least two offered actions');
    }

    const result = interpretCommand(action.name, offered);
    expect(result.decision).toBe('execute');
    expect(result.interpretedActionId).toBe(action.id);
  });

  it('returns review on ambiguous short query', () => {
    const result = interpretCommand('sanctions', offered);
    expect(result.decision).toBe('review');
    expect(result.interpretedActionId).toBeNull();
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it('rejects when no mapping is found', () => {
    const result = interpretCommand('launch weather balloon from mars', offered);
    expect(result.decision).toBe('reject');
    expect(result.interpretedActionId).toBeNull();
  });

  it('selects a bounded variant for a private custom response', () => {
    const result = interpretCommand(
      'Use a quiet private backchannel through a deniable third party to test an offramp',
      offered,
      {
        scenario,
        state: initialState,
        currentTruthModel: currentBeat?.truthModel ?? null
      }
    );

    expect(result.decision).toBe('execute');
    expect(result.interpretedActionId).toBe('backchannel_diplomacy');
    expect(result.variantId).toBe('quiet_probe');
    expect(result.variantLabel).toBe('Quiet Probe');
    expect(result.interpretationRationale).toContain('Quiet Probe');
  });
});
