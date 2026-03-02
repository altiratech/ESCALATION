import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { z } from 'zod';

import { actions, archetypes, getArchetype, getScenario, images, playerActions, scenarios } from '@wargames/content';
import {
  buildActionMap,
  buildPostGameReport,
  extendActiveCountdown,
  initializeGameState,
  resolveInactionTurn,
  resolveTurn,
  toEpisodeView
} from '@wargames/engine';

import type {
  EpisodeView,
  ExtendCountdownRequest,
  GameState,
  ResolveInactionRequest,
  SubmitActionRequest
} from '@wargames/shared-types';

import { createDb, ensureSchema, type Env } from './db';
import { createPolisher } from './polisher';
import {
  type BeatTransitionSource,
  CorruptEpisodeStateError,
  createEpisode,
  findOrCreateProfile,
  getEpisodeState,
  getEpisodeStateById,
  getReport,
  insertBeatProgress,
  insertTurnLog,
  updateEpisodeStateOptimistic,
  upsertReport
} from './repository';

const app = new Hono<{ Bindings: Env }>();

app.use('*', logger());
app.use('*', cors({
  origin: '*',
  allowHeaders: ['Content-Type'],
  allowMethods: ['GET', 'POST', 'OPTIONS']
}));

app.use('*', async (context, next) => {
  await ensureSchema(context.env);
  await next();
});

const actionMap = buildActionMap(actions);
const imageMap = new Map(images.map((asset) => [asset.id, asset]));

const computeCompositeScore = (view: EpisodeView): number => {
  const outcomeBonus: Record<string, number> = {
    stabilization: 16,
    frozen_conflict: 8,
    war: -20,
    regime_instability: -12,
    economic_collapse: -18
  };

  const baseline =
    view.meters.economicStability * 0.22 +
    view.meters.energySecurity * 0.14 +
    view.meters.domesticCohesion * 0.16 +
    view.meters.militaryReadiness * 0.08 +
    view.meters.allianceTrust * 0.2 +
    (100 - view.meters.escalationIndex) * 0.2;

  return Math.round(baseline + (view.outcome ? outcomeBonus[view.outcome] ?? 0 : 0));
};

const countdownTelemetry = (
  countdown: { seconds: number; expiresAt: number } | null | undefined,
  now: number
): { timerSeconds: number | null; timerSecondsRemaining: number | null; timerExpired: boolean } => {
  if (!countdown) {
    return {
      timerSeconds: null,
      timerSecondsRemaining: null,
      timerExpired: false
    };
  }

  const remaining = Math.max(0, Math.ceil((countdown.expiresAt - now) / 1000));
  return {
    timerSeconds: countdown.seconds,
    timerSecondsRemaining: remaining,
    timerExpired: remaining === 0
  };
};

const codenameSchema = z.object({ codename: z.string().min(2).max(40) });

app.post('/api/profiles', async (context) => {
  const payload = codenameSchema.parse(await context.req.json());
  const db = createDb(context.env);
  const profile = await findOrCreateProfile(db, payload.codename);
  return context.json(profile);
});

const startSchema = z.object({
  profileId: z.string().uuid(),
  scenarioId: z.string().min(1),
  archetypeId: z.string().min(1),
  seed: z.string().min(1).max(64).optional(),
  timerMode: z.enum(['standard', 'relaxed', 'off']).optional()
});

app.post('/api/episodes/start', async (context) => {
  const payload = startSchema.parse(await context.req.json());
  const scenario = getScenario(payload.scenarioId);
  const archetype = getArchetype(payload.archetypeId);
  const seed = payload.seed ?? `${payload.profileId}:${Date.now()}`;
  const episodeId = crypto.randomUUID();

  const requestTimestamp = Date.now();
  const state = initializeGameState(episodeId, seed, {
    scenario,
    archetype,
    actions,
    images
  }, {
    timerMode: payload.timerMode ?? 'standard',
    nowMs: requestTimestamp
  });

  const db = createDb(context.env);
  await createEpisode(db, {
    profileId: payload.profileId,
    scenarioId: scenario.id,
    archetypeId: archetype.id,
    seed,
    state
  });
  await insertBeatProgress(db, {
    episodeId,
    turnNumber: state.turn,
    beatIdBefore: state.currentBeatId,
    beatIdAfter: state.currentBeatId,
    transitionSource: 'start',
    transitioned: false,
    timerMode: state.timerMode,
    timerSeconds: state.activeCountdown?.seconds ?? null,
    timerSecondsRemaining: state.activeCountdown?.secondsRemaining ?? null,
    timerExpired: false,
    extendUsed: false,
    extendTimerUsesRemaining: state.extendTimerUsesRemaining
  });

  const view = toEpisodeView(state, actionMap, imageMap, requestTimestamp);
  const polisher = createPolisher(context.env);

  return context.json({
    ...view,
    briefing: await polisher.polish(view.briefing)
  });
});

app.get('/api/episodes/:episodeId', async (context) => {
  const episodeId = context.req.param('episodeId');
  const db = createDb(context.env);
  const state = await getEpisodeStateById(db, episodeId);

  if (!state) {
    return context.json({ message: 'Episode not found' }, 404);
  }

  const requestTimestamp = Date.now();
  const view = toEpisodeView(state, actionMap, imageMap, requestTimestamp);
  const polisher = createPolisher(context.env);

  return context.json({
    ...view,
    briefing: await polisher.polish(view.briefing)
  });
});

const actionSchema = z.object({
  expectedTurn: z.number().int().min(1),
  actionId: z.string().min(1)
});

const inactionSchema = z.object({
  expectedTurn: z.number().int().min(1),
  source: z.enum(['timeout', 'explicit']).default('explicit')
});

const extendCountdownSchema = z.object({
  expectedTurn: z.number().int().min(1)
});

app.post('/api/episodes/:episodeId/actions', async (context) => {
  const episodeId = context.req.param('episodeId');
  const payload = actionSchema.parse(await context.req.json()) as SubmitActionRequest;

  const db = createDb(context.env);
  const episodeRecord = await getEpisodeState(db, episodeId);

  if (!episodeRecord) {
    return context.json({ message: 'Episode not found' }, 404);
  }

  let state: GameState;
  try {
    state = JSON.parse(episodeRecord.stateJson);
  } catch {
    return context.json({ message: 'Corrupt episode state' }, 422);
  }
  const requestTimestamp = Date.now();

  if (state.status === 'completed') {
    const completedView = toEpisodeView(state, actionMap, imageMap, requestTimestamp);
    return context.json({
      stale: true,
      episode: completedView
    });
  }

  if (payload.expectedTurn > state.turn) {
    return context.json({ message: 'Turn mismatch: future turn submitted.' }, 409);
  }

  if (payload.expectedTurn < state.turn) {
    const staleView = toEpisodeView(state, actionMap, imageMap, requestTimestamp);
    return context.json({
      stale: true,
      episode: staleView
    });
  }

  const scenario = getScenario(state.scenarioId);
  const archetype = getArchetype(state.rivalArchetypeId);
  const engineContext = {
    scenario,
    archetype,
    actions,
    images
  };
  const polisher = createPolisher(context.env);

  const finalizeResolvedTurn = async (
    nextState: typeof state,
    resolution: ReturnType<typeof resolveTurn>['resolution'],
    analytics: {
      source: BeatTransitionSource;
      timerSeconds: number | null;
      timerSecondsRemaining: number | null;
      timerExpired: boolean;
      extendUsed: boolean;
    }
  ) => {
    const updated = await updateEpisodeStateOptimistic(db, {
      episodeId,
      expectedTurn: payload.expectedTurn,
      nextState
    });

    if (!updated) {
      const latest = await getEpisodeStateById(db, episodeId);
      if (!latest) {
        return context.json({ message: 'Episode no longer available' }, 404);
      }

      return context.json({
        stale: true,
        episode: toEpisodeView(latest, actionMap, imageMap, requestTimestamp)
      });
    }

    await insertTurnLog(db, episodeId, resolution);
    await insertBeatProgress(db, {
      episodeId,
      turnNumber: resolution.turn,
      beatIdBefore: resolution.beatIdBefore,
      beatIdAfter: resolution.beatIdAfter,
      transitionSource: analytics.source,
      transitioned: resolution.beatIdBefore !== resolution.beatIdAfter,
      timerMode: nextState.timerMode,
      timerSeconds: analytics.timerSeconds,
      timerSecondsRemaining: analytics.timerSecondsRemaining,
      timerExpired: analytics.timerExpired,
      extendUsed: analytics.extendUsed,
      extendTimerUsesRemaining: nextState.extendTimerUsesRemaining
    });

    if (nextState.status === 'completed' && nextState.outcome) {
      const report = buildPostGameReport(nextState, actionMap);
      const episodeView = toEpisodeView(nextState, actionMap, imageMap, requestTimestamp);
      await upsertReport(db, report, episodeRecord.profileId, computeCompositeScore(episodeView));
    }

    const view = toEpisodeView(nextState, actionMap, imageMap, requestTimestamp);
    return context.json({
      stale: false,
      resolution,
      episode: {
        ...view,
        briefing: await polisher.polish(view.briefing)
      }
    });
  };

  if (state.activeCountdown && requestTimestamp >= state.activeCountdown.expiresAt) {
    let timeoutResult;
    try {
      timeoutResult = resolveInactionTurn(state, engineContext, {
        source: 'timeout',
        now: requestTimestamp
      });
    } catch (error) {
      return context.json({
        message: error instanceof Error ? error.message : 'Failed to resolve countdown timeout.'
      }, 400);
    }

    return finalizeResolvedTurn(timeoutResult.nextState, timeoutResult.resolution, {
      source: 'timeout',
      timerSeconds: state.activeCountdown.seconds,
      timerSecondsRemaining: 0,
      timerExpired: true,
      extendUsed: false
    });
  }

  const preActionTimer = countdownTelemetry(state.activeCountdown, requestTimestamp);
  let result;
  try {
    result = resolveTurn(state, payload.actionId, engineContext, requestTimestamp);
  } catch (error) {
    return context.json({
      message: error instanceof Error ? error.message : 'Failed to resolve action.'
    }, 400);
  }

  return finalizeResolvedTurn(result.nextState, result.resolution, {
    source: 'action',
    timerSeconds: preActionTimer.timerSeconds,
    timerSecondsRemaining: preActionTimer.timerSecondsRemaining,
    timerExpired: false,
    extendUsed: false
  });
});

app.post('/api/episodes/:episodeId/inaction', async (context) => {
  const episodeId = context.req.param('episodeId');
  const payload = inactionSchema.parse(await context.req.json()) as ResolveInactionRequest;
  const db = createDb(context.env);
  const episodeRecord = await getEpisodeState(db, episodeId);

  if (!episodeRecord) {
    return context.json({ message: 'Episode not found' }, 404);
  }

  let state: GameState;
  try {
    state = JSON.parse(episodeRecord.stateJson);
  } catch {
    return context.json({ message: 'Corrupt episode state' }, 422);
  }
  const requestTimestamp = Date.now();

  if (state.status === 'completed') {
    return context.json({
      stale: true,
      episode: toEpisodeView(state, actionMap, imageMap, requestTimestamp)
    });
  }

  if (payload.expectedTurn > state.turn) {
    return context.json({ message: 'Turn mismatch: future turn submitted.' }, 409);
  }

  if (payload.expectedTurn < state.turn) {
    return context.json({
      stale: true,
      episode: toEpisodeView(state, actionMap, imageMap, requestTimestamp)
    });
  }

  const scenario = getScenario(state.scenarioId);
  const archetype = getArchetype(state.rivalArchetypeId);
  const engineContext = {
    scenario,
    archetype,
    actions,
    images
  };

  const preInactionTimer = countdownTelemetry(state.activeCountdown, requestTimestamp);
  let result;
  try {
    result = resolveInactionTurn(state, engineContext, {
      source: payload.source,
      now: requestTimestamp
    });
  } catch (error) {
    return context.json({
      message: error instanceof Error ? error.message : 'Failed to resolve inaction.'
    }, 400);
  }

  const updated = await updateEpisodeStateOptimistic(db, {
    episodeId,
    expectedTurn: payload.expectedTurn,
    nextState: result.nextState
  });

  if (!updated) {
    const latest = await getEpisodeStateById(db, episodeId);
    if (!latest) {
      return context.json({ message: 'Episode no longer available' }, 404);
    }

    return context.json({
      stale: true,
      episode: toEpisodeView(latest, actionMap, imageMap, requestTimestamp)
    });
  }

  await insertTurnLog(db, episodeId, result.resolution);
  await insertBeatProgress(db, {
    episodeId,
    turnNumber: result.resolution.turn,
    beatIdBefore: result.resolution.beatIdBefore,
    beatIdAfter: result.resolution.beatIdAfter,
    transitionSource: payload.source,
    transitioned: result.resolution.beatIdBefore !== result.resolution.beatIdAfter,
    timerMode: result.nextState.timerMode,
    timerSeconds: preInactionTimer.timerSeconds,
    timerSecondsRemaining: payload.source === 'timeout' ? 0 : preInactionTimer.timerSecondsRemaining,
    timerExpired: payload.source === 'timeout',
    extendUsed: false,
    extendTimerUsesRemaining: result.nextState.extendTimerUsesRemaining
  });

  if (result.nextState.status === 'completed' && result.nextState.outcome) {
    const report = buildPostGameReport(result.nextState, actionMap);
    const episodeView = toEpisodeView(result.nextState, actionMap, imageMap, requestTimestamp);
    await upsertReport(db, report, episodeRecord.profileId, computeCompositeScore(episodeView));
  }

  const view = toEpisodeView(result.nextState, actionMap, imageMap, requestTimestamp);
  const polisher = createPolisher(context.env);

  return context.json({
    stale: false,
    resolution: result.resolution,
    episode: {
      ...view,
      briefing: await polisher.polish(view.briefing)
    }
  });
});

app.post('/api/episodes/:episodeId/countdown/extend', async (context) => {
  const episodeId = context.req.param('episodeId');
  const payload = extendCountdownSchema.parse(await context.req.json()) as ExtendCountdownRequest;
  const db = createDb(context.env);
  const episodeRecord = await getEpisodeState(db, episodeId);

  if (!episodeRecord) {
    return context.json({ message: 'Episode not found' }, 404);
  }

  let state: GameState;
  try {
    state = JSON.parse(episodeRecord.stateJson);
  } catch {
    return context.json({ message: 'Corrupt episode state' }, 422);
  }
  const requestTimestamp = Date.now();

  if (state.status === 'completed') {
    return context.json({
      stale: true,
      episode: toEpisodeView(state, actionMap, imageMap, requestTimestamp)
    });
  }

  if (payload.expectedTurn > state.turn) {
    return context.json({ message: 'Turn mismatch: future turn submitted.' }, 409);
  }

  if (payload.expectedTurn < state.turn) {
    return context.json({
      stale: true,
      episode: toEpisodeView(state, actionMap, imageMap, requestTimestamp)
    });
  }

  let nextState;
  try {
    nextState = extendActiveCountdown(state, requestTimestamp);
  } catch (error) {
    return context.json({
      message: error instanceof Error ? error.message : 'Failed to extend countdown.'
    }, 400);
  }

  const updated = await updateEpisodeStateOptimistic(db, {
    episodeId,
    expectedTurn: payload.expectedTurn,
    nextState
  });

  if (!updated) {
    const latest = await getEpisodeStateById(db, episodeId);
    if (!latest) {
      return context.json({ message: 'Episode no longer available' }, 404);
    }

    return context.json({
      stale: true,
      episode: toEpisodeView(latest, actionMap, imageMap, requestTimestamp)
    });
  }

  await insertBeatProgress(db, {
    episodeId,
    turnNumber: state.turn,
    beatIdBefore: state.currentBeatId,
    beatIdAfter: state.currentBeatId,
    transitionSource: 'extend',
    transitioned: false,
    timerMode: nextState.timerMode,
    timerSeconds: nextState.activeCountdown?.seconds ?? null,
    timerSecondsRemaining: nextState.activeCountdown?.secondsRemaining ?? null,
    timerExpired: false,
    extendUsed: true,
    extendTimerUsesRemaining: nextState.extendTimerUsesRemaining
  });

  const view = toEpisodeView(nextState, actionMap, imageMap, requestTimestamp);
  const polisher = createPolisher(context.env);

  return context.json({
    stale: false,
    episode: {
      ...view,
      briefing: await polisher.polish(view.briefing)
    }
  });
});

app.get('/api/episodes/:episodeId/report', async (context) => {
  const episodeId = context.req.param('episodeId');
  const db = createDb(context.env);

  const report = await getReport(db, episodeId);
  if (report) {
    return context.json(report);
  }

  const episode = await getEpisodeStateById(db, episodeId);
  if (!episode) {
    return context.json({ message: 'Episode not found' }, 404);
  }

  if (episode.status !== 'completed') {
    return context.json({ message: 'Report not ready' }, 404);
  }

  const generated = buildPostGameReport(episode, actionMap);
  const episodeRecord = await getEpisodeState(db, episodeId);
  if (episodeRecord) {
    const view = toEpisodeView(episode, actionMap, imageMap, Date.now());
    await upsertReport(db, generated, episodeRecord.profileId, computeCompositeScore(view));
  }

  return context.json(generated);
});

app.get('/api/reference/bootstrap', (context) => {
  context.header('Cache-Control', 'public, max-age=300');
  return context.json({
    scenarios,
    archetypes,
    actions: playerActions
  });
});

app.get('/healthz', (context) => {
  return context.json({ status: 'ok' });
});

app.get('/api/healthz', (context) => {
  return context.json({ status: 'ok' });
});

app.notFound((context) => {
  return context.json({ message: 'Route not found' }, 404);
});

app.onError((error, context) => {
  console.error(error);
  return context.json({ message: error.message || 'Internal error' }, 500);
});

export default app;
