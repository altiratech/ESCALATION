import { describe, expect, it } from 'vitest';

import type { GameState, TurnResolution } from '@wargames/shared-types';

import {
  persistEpisodeAndBeatProgressAtomic,
  persistResolvedTurnAtomic,
  type BeatProgressPayload
} from '../../apps/api/src/repository';

class MockPreparedStatement {
  readonly query: string;
  values: unknown[] = [];

  constructor(query: string) {
    this.query = query;
  }

  bind(...values: unknown[]): D1PreparedStatement {
    this.values = values;
    return this as unknown as D1PreparedStatement;
  }
}

class MockD1Database {
  readonly preparedQueries: string[] = [];
  readonly batchCalls: MockPreparedStatement[][] = [];
  private readonly batchResultsQueue: Array<D1Result[]>;

  constructor(batchResultsQueue: Array<D1Result[]>) {
    this.batchResultsQueue = batchResultsQueue;
  }

  prepare(query: string): D1PreparedStatement {
    this.preparedQueries.push(query);
    return new MockPreparedStatement(query) as unknown as D1PreparedStatement;
  }

  async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    this.batchCalls.push(statements as unknown as MockPreparedStatement[]);
    return (this.batchResultsQueue.shift() ?? []) as D1Result<T>[];
  }
}

const makeResult = (changes: number, results: Array<Record<string, unknown>> = []): D1Result =>
  ({
    success: true,
    meta: { changes },
    results
  }) as D1Result;

const nextState = {
  id: 'episode-1',
  scenarioId: 'northern_strait_flashpoint',
  turn: 2,
  maxTurns: 10,
  status: 'active',
  meters: {
    escalationIndex: 40,
    allianceTrust: 62,
    economicStability: 55,
    domesticCohesion: 58,
    militaryReadiness: 61,
    energySecurity: 57
  },
  latent: {
    rivalResolve: 61,
    rivalPatience: 44,
    alliedConfidence: 57,
    civilianFear: 31
  },
  beliefs: {
    rivalResolve: 58,
    rivalPatience: 47,
    alliedConfidence: 54,
    civilianFear: 36
  },
  intelQuality: {
    escalationIndex: 65,
    allianceTrust: 59,
    economicStability: 62,
    domesticCohesion: 48,
    militaryReadiness: 71,
    energySecurity: 51
  },
  delayedQueue: [],
  offeredActionIds: ['public_warning'],
  recentImageIds: [],
  currentBeatId: 'ns_crisis_window',
  beatHistory: ['ns_opening'],
  activeAdvisors: ['cross', 'chen'],
  scenarioRole: 'National Security Advisor',
  meterLabels: {
    escalationIndex: 'Escalation',
    allianceTrust: 'Alliance',
    economicStability: 'Economic',
    domesticCohesion: 'Domestic',
    militaryReadiness: 'Military',
    energySecurity: 'Energy'
  },
  timerMode: 'standard',
  extendTimerUsesRemaining: 1,
  activeCountdown: null,
  turnDebrief: null,
  history: [],
  seed: 'SEED1234',
  rngState: 42,
  outcome: null,
  openingBriefing: {
    briefingParagraph: 'Opening brief',
    headlines: ['Headline']
  }
} as GameState;

const resolution = {
  turn: 1,
  beatIdBefore: 'ns_opening',
  beatIdAfter: 'ns_crisis_window',
  playerActionId: 'public_warning',
  rivalActionId: 'inspection_regime',
  triggeredEvents: [],
  selectedImageId: null,
  narrative: {
    briefingParagraph: 'Resolved',
    headlines: ['Headline one']
  },
  turnDebrief: {
    lines: []
  },
  visibleRanges: {
    escalationIndex: { low: 35, high: 45, confidence: 70 },
    allianceTrust: { low: 55, high: 65, confidence: 68 },
    economicStability: { low: 50, high: 60, confidence: 60 },
    domesticCohesion: { low: 54, high: 62, confidence: 58 },
    militaryReadiness: { low: 56, high: 66, confidence: 73 },
    energySecurity: { low: 52, high: 60, confidence: 61 }
  },
  meterBefore: nextState.meters,
  meterAfter: nextState.meters,
  beliefsAfter: nextState.beliefs,
  offeredActionIdsNext: ['backchannel_diplomacy'],
  ended: false,
  outcome: null,
  rngTrace: [0.1, 0.2]
} as TurnResolution;

const beatProgress = {
  episodeId: 'episode-1',
  turnNumber: 1,
  beatIdBefore: 'ns_opening',
  beatIdAfter: 'ns_crisis_window',
  transitionSource: 'action',
  transitioned: true,
  timerMode: 'standard',
  timerSeconds: 90,
  timerSecondsRemaining: 42,
  timerExpired: false,
  extendUsed: false,
  extendTimerUsesRemaining: 1
} satisfies BeatProgressPayload;

describe('repository atomic persistence', () => {
  it('uses D1 batch semantics instead of raw SQL transaction statements for resolved turns', async () => {
    const rawDb = new MockD1Database([
      [makeResult(1), makeResult(1), makeResult(1), makeResult(0, [{ applied: 1 }])]
    ]) as unknown as D1Database;

    const result = await persistResolvedTurnAtomic(rawDb, {
      episodeId: 'episode-1',
      expectedTurn: 1,
      expectedStateJson: '{"before":true}',
      nextState,
      resolution,
      beatProgress,
      endedAt: null
    });

    expect(result).toEqual({
      updated: true,
      turnInserted: true,
      beatInserted: true
    });

    const preparedQueries = (rawDb as unknown as MockD1Database).preparedQueries.join('\n');
    expect(preparedQueries).not.toContain('BEGIN IMMEDIATE');
    expect(preparedQueries).not.toContain('COMMIT');
    expect(preparedQueries).not.toContain('ROLLBACK');
    expect((rawDb as unknown as MockD1Database).batchCalls).toHaveLength(1);
    expect(preparedQueries).toContain('INSERT OR IGNORE INTO turn_logs');
    expect(preparedQueries).toContain('WHERE EXISTS');
  });

  it('treats an already-applied countdown extension as non-stale without SQL transactions', async () => {
    const rawDb = new MockD1Database([
      [makeResult(0), makeResult(0), makeResult(0, [{ applied: 1 }])]
    ]) as unknown as D1Database;

    const result = await persistEpisodeAndBeatProgressAtomic(rawDb, {
      episodeId: 'episode-1',
      expectedTurn: 1,
      expectedStateJson: '{"before":true}',
      nextState,
      beatProgress: {
        ...beatProgress,
        transitionSource: 'extend',
        transitioned: false,
        extendUsed: true
      },
      endedAt: null
    });

    expect(result).toEqual({
      updated: true,
      beatInserted: false
    });

    const preparedQueries = (rawDb as unknown as MockD1Database).preparedQueries.join('\n');
    expect(preparedQueries).not.toContain('BEGIN IMMEDIATE');
    expect(preparedQueries).not.toContain('COMMIT');
    expect(preparedQueries).not.toContain('ROLLBACK');
    expect((rawDb as unknown as MockD1Database).batchCalls).toHaveLength(1);
  });

  it('treats an already-applied turn retry as idempotent when the target state is present', async () => {
    const rawDb = new MockD1Database([
      [makeResult(0), makeResult(0), makeResult(0), makeResult(0, [{ applied: 1 }])]
    ]) as unknown as D1Database;

    const result = await persistResolvedTurnAtomic(rawDb, {
      episodeId: 'episode-1',
      expectedTurn: 1,
      expectedStateJson: '{"before":true}',
      nextState,
      resolution,
      beatProgress,
      endedAt: null
    });

    expect(result).toEqual({
      updated: true,
      turnInserted: false,
      beatInserted: false
    });
  });

  it('reports a real conflict as stale when neither update nor applied-state check succeeds', async () => {
    const rawDb = new MockD1Database([
      [makeResult(0), makeResult(0), makeResult(0), makeResult(0)]
    ]) as unknown as D1Database;

    const result = await persistResolvedTurnAtomic(rawDb, {
      episodeId: 'episode-1',
      expectedTurn: 1,
      expectedStateJson: '{"before":true}',
      nextState,
      resolution,
      beatProgress,
      endedAt: null
    });

    expect(result).toEqual({
      updated: false,
      turnInserted: false,
      beatInserted: false
    });
  });
});
