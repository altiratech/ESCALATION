import { describe, expect, it } from 'vitest';

import { actions, adversaryProfiles, images, scenarios } from '@wargames/content';
import { initializeGameState } from '@wargames/engine';

import {
  CURRENT_GAME_STATE_SCHEMA_VERSION,
  GameStateValidationError,
  parseGameStateJson
} from '../../apps/api/src/stateSchema';

const scenario = scenarios.find((entry) => !entry.isLegacy) ?? scenarios[0];
const adversaryProfile = adversaryProfiles.find((entry) => entry.id === scenario?.adversaryProfileId) ?? adversaryProfiles[0];

describe('game state schema migration', () => {
  it('stamps new states with the current schema version', () => {
    if (!scenario || !adversaryProfile) {
      throw new Error('Test content unavailable');
    }

    const state = initializeGameState('schema-version-new', 'SCHEMA-VERSION-NEW', {
      scenario,
      adversaryProfile,
      actions,
      images
    });

    expect(state.schemaVersion).toBe(CURRENT_GAME_STATE_SCHEMA_VERSION);
  });

  it('loads pre-versioned state snapshots by migrating them to the current version', () => {
    if (!scenario || !adversaryProfile) {
      throw new Error('Test content unavailable');
    }

    const state = initializeGameState('schema-version-legacy', 'SCHEMA-VERSION-LEGACY', {
      scenario,
      adversaryProfile,
      actions,
      images
    });
    const legacyState = { ...state } as Record<string, unknown>;
    delete legacyState.schemaVersion;

    const parsed = parseGameStateJson(JSON.stringify(legacyState), 'schema-version-legacy');

    expect(parsed.schemaVersion).toBe(CURRENT_GAME_STATE_SCHEMA_VERSION);
    expect(parsed.id).toBe(state.id);
    expect(parsed.currentBeatId).toBe(state.currentBeatId);
  });

  it('rejects future state schema versions instead of silently corrupting a run', () => {
    if (!scenario || !adversaryProfile) {
      throw new Error('Test content unavailable');
    }

    const state = initializeGameState('schema-version-future', 'SCHEMA-VERSION-FUTURE', {
      scenario,
      adversaryProfile,
      actions,
      images
    });

    try {
      parseGameStateJson(
        JSON.stringify({
          ...state,
          schemaVersion: CURRENT_GAME_STATE_SCHEMA_VERSION + 1
        }),
        'schema-version-future'
      );
      throw new Error('Expected future schema version to be rejected.');
    } catch (error) {
      expect(error).toBeInstanceOf(GameStateValidationError);
      expect((error as GameStateValidationError).issues.join('\n')).toContain('Unsupported future schema version');
    }
  });
});
