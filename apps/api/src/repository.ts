import { and, desc, eq } from 'drizzle-orm';

import type { GameState, PostGameReport, TurnResolution } from '@wargames/shared-types';

import type { Database } from './db';
import { beatProgress, episodes, profiles, reports, scores, turnLogs } from './schema';

const randomId = (): string => crypto.randomUUID();

const toJson = (value: unknown): string => JSON.stringify(value);
const toFlag = (value: boolean): number => (value ? 1 : 0);

export class CorruptEpisodeStateError extends Error {
  constructor(episodeId: string, cause?: unknown) {
    super(`Corrupt or unreadable episode state for ${episodeId}`);
    this.name = 'CorruptEpisodeStateError';
    this.cause = cause;
  }
}

const parseStateJson = (stateJson: string, episodeId: string): GameState => {
  try {
    return JSON.parse(stateJson) as GameState;
  } catch (error) {
    throw new CorruptEpisodeStateError(episodeId, error);
  }
};

export interface EpisodeRecord {
  id: string;
  profileId: string;
  scenarioId: string;
  adversaryProfileId: string;
  seed: string;
  status: string;
  currentTurn: number;
  outcome: string | null;
  stateJson: string;
  startedAt: string;
  endedAt: string | null;
}

export const findOrCreateProfile = async (db: Database, codenameRaw: string): Promise<{ profileId: string; codename: string }> => {
  const codename = codenameRaw.trim().slice(0, 40);
  if (!codename) {
    throw new Error('Codename is required');
  }

  const existing = await db.select().from(profiles).where(eq(profiles.codename, codename)).limit(1);
  if (existing[0]) {
    return {
      profileId: existing[0].id,
      codename: existing[0].codename
    };
  }

  const id = randomId();
  await db.insert(profiles).values({
    id,
    codename
  });

  return {
    profileId: id,
    codename
  };
};

export const createEpisode = async (
  rawDb: D1Database,
  payload: {
    profileId: string;
    scenarioId: string;
    adversaryProfileId: string;
    seed: string;
    state: GameState;
  }
): Promise<void> => {
  const episodeColumnsInfo = await rawDb.prepare('PRAGMA table_info(episodes)').all<{ name: string }>();
  const episodeColumns = new Set((episodeColumnsInfo.results ?? []).map((column) => column.name));
  const stateJson = toJson(payload.state);

  if (episodeColumns.has('archetype_id')) {
    await rawDb.prepare(
      `INSERT INTO episodes (
        id, profile_id, scenario_id, adversary_profile_id, archetype_id, seed,
        status, current_turn, outcome, state_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      payload.state.id,
      payload.profileId,
      payload.scenarioId,
      payload.adversaryProfileId,
      payload.adversaryProfileId,
      payload.seed,
      payload.state.status,
      payload.state.turn,
      payload.state.outcome,
      stateJson
    ).run();
    return;
  }

  await rawDb.prepare(
    `INSERT INTO episodes (
      id, profile_id, scenario_id, adversary_profile_id, seed,
      status, current_turn, outcome, state_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    payload.state.id,
    payload.profileId,
    payload.scenarioId,
    payload.adversaryProfileId,
    payload.seed,
    payload.state.status,
    payload.state.turn,
    payload.state.outcome,
    stateJson
  ).run();
};

export const getEpisodeState = async (
  db: Database,
  episodeId: string
): Promise<EpisodeRecord | null> => {
  const rows = await db.select().from(episodes).where(eq(episodes.id, episodeId)).limit(1);
  return rows[0] ?? null;
};

export const getEpisodeStateById = async (
  db: Database,
  episodeId: string
): Promise<GameState | null> => {
  const record = await getEpisodeState(db, episodeId);
  if (!record) {
    return null;
  }

  return parseStateJson(record.stateJson, episodeId);
};

export const updateEpisodeStateOptimistic = async (
  db: Database,
  payload: {
    episodeId: string;
    expectedTurn: number;
    expectedStateJson?: string;
    nextState: GameState;
  }
): Promise<boolean> => {
  const optimisticChecks = [
    eq(episodes.id, payload.episodeId),
    eq(episodes.currentTurn, payload.expectedTurn)
  ];
  if (payload.expectedStateJson !== undefined) {
    optimisticChecks.push(eq(episodes.stateJson, payload.expectedStateJson));
  }

  const result = await db
    .update(episodes)
    .set({
      currentTurn: payload.nextState.turn,
      status: payload.nextState.status,
      stateJson: toJson(payload.nextState),
      outcome: payload.nextState.outcome,
      endedAt: payload.nextState.status === 'completed' ? new Date().toISOString() : null
    })
    .where(and(...optimisticChecks));

  const changes = (result as unknown as { meta?: { changes?: number } }).meta?.changes ?? 0;
  return changes > 0;
};

const getChanges = (result: unknown): number => (result as { meta?: { changes?: number } }).meta?.changes ?? 0;

export const insertTurnLog = async (
  db: Database,
  episodeId: string,
  resolution: TurnResolution
): Promise<void> => {
  const id = `${episodeId}:${resolution.turn}`;
  await db.insert(turnLogs).values({
    id,
    episodeId,
    turnNumber: resolution.turn,
    playerActionId: resolution.playerActionId,
    rivalActionId: resolution.rivalActionId,
    eventsJson: toJson(resolution.triggeredEvents),
    beliefJson: toJson(resolution.beliefsAfter),
    visibleMetersJson: toJson(resolution.visibleRanges),
    trueMetersJson: toJson(resolution.meterAfter),
    briefingText: resolution.narrative.briefingParagraph,
    headlinesJson: toJson(resolution.narrative.headlines),
    imageId: resolution.selectedImageId,
    rngTraceJson: toJson(resolution.rngTrace)
  }).onConflictDoNothing();
};

export type BeatTransitionSource = 'start' | 'action' | 'timeout' | 'explicit' | 'extend';
export interface BeatProgressPayload {
  episodeId: string;
  turnNumber: number;
  beatIdBefore: string;
  beatIdAfter: string;
  transitionSource: BeatTransitionSource;
  transitioned: boolean;
  timerMode: 'standard' | 'relaxed' | 'off';
  timerSeconds: number | null;
  timerSecondsRemaining: number | null;
  timerExpired: boolean;
  extendUsed: boolean;
  extendTimerUsesRemaining: number;
}

export interface PersistResolvedTurnPayload {
  episodeId: string;
  expectedTurn: number;
  expectedStateJson?: string;
  nextState: GameState;
  resolution: TurnResolution;
  beatProgress: BeatProgressPayload;
  endedAt: string | null;
}

export interface PersistResolvedTurnResult {
  updated: boolean;
  turnInserted: boolean;
  beatInserted: boolean;
}

export interface PersistEpisodeAndBeatProgressPayload {
  episodeId: string;
  expectedTurn: number;
  expectedStateJson?: string;
  nextState: GameState;
  beatProgress: BeatProgressPayload;
  endedAt: string | null;
}

export interface PersistEpisodeAndBeatProgressResult {
  updated: boolean;
  beatInserted: boolean;
}

export const buildBeatProgressId = (payload: BeatProgressPayload): string =>
  [
    payload.episodeId,
    payload.turnNumber,
    payload.transitionSource,
    payload.beatIdBefore,
    payload.beatIdAfter,
    payload.timerMode,
    payload.extendUsed ? 'extend' : 'no-extend',
    payload.timerExpired ? 'expired' : 'active'
  ].join(':');

export const persistResolvedTurnAtomic = async (
  rawDb: D1Database,
  payload: PersistResolvedTurnPayload
): Promise<PersistResolvedTurnResult> => {
  const nextStateJson = toJson(payload.nextState);
  const expectedStateJson = payload.expectedStateJson ?? null;

  const turnLogId = `${payload.episodeId}:${payload.resolution.turn}`;
  const beatProgressId = buildBeatProgressId(payload.beatProgress);

  await rawDb.prepare('BEGIN IMMEDIATE').run();
  try {
    const updateResult = await rawDb.prepare(
      `UPDATE episodes
       SET current_turn = ?1,
           status = ?2,
           state_json = ?3,
           outcome = ?4,
           ended_at = ?5
       WHERE id = ?6
         AND current_turn = ?7
         AND (?8 IS NULL OR state_json = ?8)`
    ).bind(
      payload.nextState.turn,
      payload.nextState.status,
      nextStateJson,
      payload.nextState.outcome,
      payload.endedAt,
      payload.episodeId,
      payload.expectedTurn,
      expectedStateJson
    ).run();

    if (getChanges(updateResult) === 0) {
      await rawDb.prepare('ROLLBACK').run();
      return {
        updated: false,
        turnInserted: false,
        beatInserted: false
      };
    }

    const turnInsertResult = await rawDb.prepare(
      `INSERT OR IGNORE INTO turn_logs (
        id, episode_id, turn_number, player_action_id, rival_action_id,
        events_json, belief_json, visible_meters_json, true_meters_json,
        briefing_text, headlines_json, image_id, rng_trace_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      turnLogId,
      payload.episodeId,
      payload.resolution.turn,
      payload.resolution.playerActionId,
      payload.resolution.rivalActionId,
      toJson(payload.resolution.triggeredEvents),
      toJson(payload.resolution.beliefsAfter),
      toJson(payload.resolution.visibleRanges),
      toJson(payload.resolution.meterAfter),
      payload.resolution.narrative.briefingParagraph,
      toJson(payload.resolution.narrative.headlines),
      payload.resolution.selectedImageId,
      toJson(payload.resolution.rngTrace)
    ).run();

    const beatInsertResult = await rawDb.prepare(
      `INSERT OR IGNORE INTO beat_progress (
        id, episode_id, turn_number, beat_id_before, beat_id_after,
        transition_source, transitioned, timer_mode, timer_seconds,
        timer_seconds_remaining, timer_expired, extend_used, extend_timer_uses_remaining
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      beatProgressId,
      payload.beatProgress.episodeId,
      payload.beatProgress.turnNumber,
      payload.beatProgress.beatIdBefore,
      payload.beatProgress.beatIdAfter,
      payload.beatProgress.transitionSource,
      toFlag(payload.beatProgress.transitioned),
      payload.beatProgress.timerMode,
      payload.beatProgress.timerSeconds,
      payload.beatProgress.timerSecondsRemaining,
      toFlag(payload.beatProgress.timerExpired),
      toFlag(payload.beatProgress.extendUsed),
      payload.beatProgress.extendTimerUsesRemaining
    ).run();

    await rawDb.prepare('COMMIT').run();
    return {
      updated: true,
      turnInserted: getChanges(turnInsertResult) > 0,
      beatInserted: getChanges(beatInsertResult) > 0
    };
  } catch (error) {
    try {
      await rawDb.prepare('ROLLBACK').run();
    } catch {
      // Ignore rollback errors; preserve original failure.
    }
    throw error;
  }
};

export const persistEpisodeAndBeatProgressAtomic = async (
  rawDb: D1Database,
  payload: PersistEpisodeAndBeatProgressPayload
): Promise<PersistEpisodeAndBeatProgressResult> => {
  const nextStateJson = toJson(payload.nextState);
  const expectedStateJson = payload.expectedStateJson ?? null;
  const beatProgressId = buildBeatProgressId(payload.beatProgress);

  await rawDb.prepare('BEGIN IMMEDIATE').run();
  try {
    const updateResult = await rawDb.prepare(
      `UPDATE episodes
       SET current_turn = ?1,
           status = ?2,
           state_json = ?3,
           outcome = ?4,
           ended_at = ?5
       WHERE id = ?6
         AND current_turn = ?7
         AND (?8 IS NULL OR state_json = ?8)`
    ).bind(
      payload.nextState.turn,
      payload.nextState.status,
      nextStateJson,
      payload.nextState.outcome,
      payload.endedAt,
      payload.episodeId,
      payload.expectedTurn,
      expectedStateJson
    ).run();

    if (getChanges(updateResult) === 0) {
      await rawDb.prepare('ROLLBACK').run();
      return {
        updated: false,
        beatInserted: false
      };
    }

    const beatInsertResult = await rawDb.prepare(
      `INSERT OR IGNORE INTO beat_progress (
        id, episode_id, turn_number, beat_id_before, beat_id_after,
        transition_source, transitioned, timer_mode, timer_seconds,
        timer_seconds_remaining, timer_expired, extend_used, extend_timer_uses_remaining
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      beatProgressId,
      payload.beatProgress.episodeId,
      payload.beatProgress.turnNumber,
      payload.beatProgress.beatIdBefore,
      payload.beatProgress.beatIdAfter,
      payload.beatProgress.transitionSource,
      toFlag(payload.beatProgress.transitioned),
      payload.beatProgress.timerMode,
      payload.beatProgress.timerSeconds,
      payload.beatProgress.timerSecondsRemaining,
      toFlag(payload.beatProgress.timerExpired),
      toFlag(payload.beatProgress.extendUsed),
      payload.beatProgress.extendTimerUsesRemaining
    ).run();

    await rawDb.prepare('COMMIT').run();
    return {
      updated: true,
      beatInserted: getChanges(beatInsertResult) > 0
    };
  } catch (error) {
    try {
      await rawDb.prepare('ROLLBACK').run();
    } catch {
      // Ignore rollback errors; preserve original failure.
    }
    throw error;
  }
};

export const insertBeatProgress = async (
  db: Database,
  payload: BeatProgressPayload
): Promise<void> => {
  await db.insert(beatProgress).values({
    id: buildBeatProgressId(payload),
    episodeId: payload.episodeId,
    turnNumber: payload.turnNumber,
    beatIdBefore: payload.beatIdBefore,
    beatIdAfter: payload.beatIdAfter,
    transitionSource: payload.transitionSource,
    transitioned: toFlag(payload.transitioned),
    timerMode: payload.timerMode,
    timerSeconds: payload.timerSeconds,
    timerSecondsRemaining: payload.timerSecondsRemaining,
    timerExpired: toFlag(payload.timerExpired),
    extendUsed: toFlag(payload.extendUsed),
    extendTimerUsesRemaining: payload.extendTimerUsesRemaining
  }).onConflictDoNothing();
};

export const upsertReport = async (
  db: Database,
  report: PostGameReport,
  profileId: string,
  compositeScore: number
): Promise<void> => {
  await db
    .insert(reports)
    .values({
      episodeId: report.episodeId,
      reportJson: toJson(report)
    })
    .onConflictDoUpdate({
      target: reports.episodeId,
      set: {
        reportJson: toJson(report),
        createdAt: new Date().toISOString()
      }
    });

  await db
    .insert(scores)
    .values({
      episodeId: report.episodeId,
      profileId,
      compositeScore
    })
    .onConflictDoUpdate({
      target: [scores.episodeId, scores.profileId],
      set: {
        compositeScore,
        createdAt: new Date().toISOString()
      }
    });
};

export const getReport = async (db: Database, episodeId: string): Promise<PostGameReport | null> => {
  const rows = await db.select().from(reports).where(eq(reports.episodeId, episodeId)).limit(1);
  if (!rows[0]) {
    return null;
  }

  try {
    return JSON.parse(rows[0].reportJson) as PostGameReport;
  } catch {
    return null;
  }
};

export const getLatestTurns = async (
  db: Database,
  episodeId: string,
  limit = 5
): Promise<Array<{ turnNumber: number; playerActionId: string; rivalActionId: string; createdAt: string }>> => {
  const rows = await db
    .select({
      turnNumber: turnLogs.turnNumber,
      playerActionId: turnLogs.playerActionId,
      rivalActionId: turnLogs.rivalActionId,
      createdAt: turnLogs.createdAt
    })
    .from(turnLogs)
    .where(eq(turnLogs.episodeId, episodeId))
    .orderBy(desc(turnLogs.turnNumber))
    .limit(limit);

  return rows;
};
