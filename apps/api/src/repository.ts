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
  archetypeId: string;
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
  db: Database,
  payload: {
    profileId: string;
    scenarioId: string;
    archetypeId: string;
    seed: string;
    state: GameState;
  }
): Promise<void> => {
  await db.insert(episodes).values({
    id: payload.state.id,
    profileId: payload.profileId,
    scenarioId: payload.scenarioId,
    archetypeId: payload.archetypeId,
    seed: payload.seed,
    status: payload.state.status,
    currentTurn: payload.state.turn,
    outcome: payload.state.outcome,
    stateJson: toJson(payload.state)
  });
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
    nextState: GameState;
  }
): Promise<boolean> => {
  const result = await db
    .update(episodes)
    .set({
      currentTurn: payload.nextState.turn,
      status: payload.nextState.status,
      stateJson: toJson(payload.nextState),
      outcome: payload.nextState.outcome,
      endedAt: payload.nextState.status === 'completed' ? new Date().toISOString() : null
    })
    .where(and(eq(episodes.id, payload.episodeId), eq(episodes.currentTurn, payload.expectedTurn)));

  const changes = (result as unknown as { meta?: { changes?: number } }).meta?.changes ?? 0;
  return changes > 0;
};

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

export const insertBeatProgress = async (
  db: Database,
  payload: {
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
): Promise<void> => {
  await db.insert(beatProgress).values({
    id: randomId(),
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
  });
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
