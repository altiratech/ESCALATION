import { describe, expect, it } from 'vitest';

import { actions } from '@wargames/content';

import { interpretCommand } from '../../apps/api/src/interpret';

describe('interpretCommand', () => {
  const offered = actions.filter((entry) => entry.actor === 'player').slice(0, 8);

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
});
