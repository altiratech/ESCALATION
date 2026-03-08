import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { z } from 'zod';

import {
  actions,
  actionNarratives,
  adversaryProfiles,
  cinematics,
  getDebriefDeep,
  getDebriefVariants,
  getAdvisorRetrospectivesForOutcome,
  getCausalityRevealForOutcome,
  getRivalLeader,
  getScenario,
  getScenarioAdversaryProfile,
  images,
  intelFragments,
  narrativeCandidates,
  newsWire,
  scenarioWorld,
  advisorDossiers,
  rivalLeaders,
  playerActions,
  scenarios
} from '@wargames/content';
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
  ActionDefinition,
  EpisodeView,
  ExtendCountdownRequest,
  GameState,
  InterpretCommandRequest,
  ResolveInactionRequest,
  SubmitActionRequest
} from '@wargames/shared-types';

import { createDb, ensureSchema, type Env } from './db';
import { createPolisher } from './polisher';
import {
  type BeatTransitionSource,
  createEpisode,
  findOrCreateProfile,
  getEpisodeState,
  getEpisodeStateById,
  getReport,
  insertBeatProgress,
  persistEpisodeAndBeatProgressAtomic,
  persistResolvedTurnAtomic,
  upsertReport
} from './repository';
import { interpretCommand as interpretCommandText } from './interpret';

const DEFAULT_ALLOWED_ORIGINS = [
  'https://escalation.altiratech.com',
  'https://escalation-web.pages.dev',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];

const RATE_LIMITED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const RATE_LIMIT_PRUNE_THRESHOLD = 2_000;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();

const normalizeOrigin = (origin: string): string => origin.trim().replace(/\/+$/, '');

const parsePositiveInt = (raw: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const resolveAllowedOrigins = (env: Env): { allowAll: boolean; origins: Set<string> } => {
  const configured = env.CORS_ALLOW_ORIGINS?.trim();
  if (configured === '*') {
    return { allowAll: true, origins: new Set() };
  }

  if (configured) {
    return {
      allowAll: false,
      origins: new Set(
        configured
          .split(',')
          .map((origin) => normalizeOrigin(origin))
          .filter((origin) => origin.length > 0)
      )
    };
  }

  return {
    allowAll: false,
    origins: new Set(DEFAULT_ALLOWED_ORIGINS)
  };
};

const app = new Hono<{ Bindings: Env }>();

app.use('*', logger());
app.use('*', cors({
  origin: (origin, context) => {
    const { allowAll, origins } = resolveAllowedOrigins(context.env);
    if (allowAll) {
      return origin;
    }
    if (!origin) {
      return null;
    }
    return origins.has(normalizeOrigin(origin)) ? origin : null;
  },
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'OPTIONS']
}));

app.use('/api/*', async (context, next) => {
  if (!RATE_LIMITED_METHODS.has(context.req.method)) {
    await next();
    return;
  }

  if (context.req.path === '/api/healthz') {
    await next();
    return;
  }

  if (context.env.RATE_LIMIT_ENABLED === '0') {
    await next();
    return;
  }

  const maxRequests = parsePositiveInt(context.env.RATE_LIMIT_MAX_REQUESTS, 120);
  const windowMs = parsePositiveInt(context.env.RATE_LIMIT_WINDOW_SECONDS, 60) * 1000;
  const now = Date.now();
  const forwardedFor = context.req.header('CF-Connecting-IP') ?? context.req.header('X-Forwarded-For') ?? 'unknown';
  const clientIp = forwardedFor.split(',')[0]?.trim() || 'unknown';
  const key = `${clientIp}:${context.req.method}`;

  if (rateLimitStore.size > RATE_LIMIT_PRUNE_THRESHOLD) {
    for (const [entryKey, entry] of rateLimitStore.entries()) {
      if (now >= entry.resetAt) {
        rateLimitStore.delete(entryKey);
      }
    }
  }

  let entry = rateLimitStore.get(key);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    rateLimitStore.set(key, entry);
  }

  if (entry.count >= maxRequests) {
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    context.header('Retry-After', String(retryAfterSeconds));
    context.header('X-RateLimit-Limit', String(maxRequests));
    context.header('X-RateLimit-Remaining', '0');
    context.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));
    return context.json({ message: 'Rate limit exceeded. Try again shortly.' }, 429);
  }

  entry.count += 1;
  context.header('X-RateLimit-Limit', String(maxRequests));
  context.header('X-RateLimit-Remaining', String(Math.max(0, maxRequests - entry.count)));
  context.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

  await next();
});

app.use('*', async (context, next) => {
  await ensureSchema(context.env);
  await next();
});

const actionMap = buildActionMap(actions);
const imageMap = new Map(images.map((asset) => [asset.id, asset]));
const debriefVariants = getDebriefVariants();

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
  seed: z.string().min(1).max(64).optional(),
  timerMode: z.enum(['standard', 'relaxed', 'off']).optional()
});

app.post('/api/episodes/start', async (context) => {
  const payload = startSchema.parse(await context.req.json());
  const scenario = getScenario(payload.scenarioId);
  const adversaryProfile = getScenarioAdversaryProfile(scenario.id);
  const episodeId = crypto.randomUUID();
  const seed = payload.seed ?? episodeId;

  const requestTimestamp = Date.now();
  const state = initializeGameState(episodeId, seed, {
    scenario,
    adversaryProfile,
    actions,
    images
  }, {
    timerMode: payload.timerMode ?? 'standard',
    nowMs: requestTimestamp
  });

  const db = createDb(context.env);
  await createEpisode(context.env.DB, {
    profileId: payload.profileId,
    scenarioId: scenario.id,
    adversaryProfileId: adversaryProfile.id,
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

const interpretSchema = z.object({
  expectedTurn: z.number().int().min(1),
  commandText: z.string().min(1).max(300)
});

const buildInterpretationMessage = (input: {
  decision: 'execute' | 'review' | 'reject';
  confidencePercent: number;
  interpretedActionName: string | null;
  suggestions: Array<{ actionName: string }>;
  roleLabel: string;
}): string => {
  const { decision, confidencePercent, interpretedActionName, suggestions, roleLabel } = input;
  const listedSuggestions = suggestions.map((entry) => entry.actionName).join(', ');

  if (decision === 'execute' && interpretedActionName) {
    return `Command mapped to "${interpretedActionName}" (${confidencePercent}% confidence).`;
  }

  if (decision === 'review') {
    if (suggestions.length > 0) {
      return `${roleLabel} channel needs clarification (${confidencePercent}% confidence). Confirm one: ${listedSuggestions}.`;
    }
    return `${roleLabel} channel needs clarification (${confidencePercent}% confidence). Rephrase or use an action card.`;
  }

  if (suggestions.length > 0) {
    return `${roleLabel} directive not recognized (${confidencePercent}% confidence). Try: ${listedSuggestions}.`;
  }

  return `${roleLabel} directive not recognized (${confidencePercent}% confidence). Rephrase or use an action card.`;
};

app.post('/api/episodes/:episodeId/interpret', async (context) => {
  const episodeId = context.req.param('episodeId');
  const payload = interpretSchema.parse(await context.req.json()) as InterpretCommandRequest;
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
  const polisher = createPolisher(context.env);

  if (state.status === 'completed') {
    const completedView = toEpisodeView(state, actionMap, imageMap, requestTimestamp);
    return context.json({
      stale: true,
      confidence: 1,
      decision: 'reject',
      interpretedActionId: null,
      interpretedActionName: null,
      message: 'Episode is already complete.',
      suggestions: [],
      episode: {
        ...completedView,
        briefing: await polisher.polish(completedView.briefing)
      }
    });
  }

  if (payload.expectedTurn > state.turn) {
    return context.json({ message: 'Turn mismatch: future turn submitted.' }, 409);
  }

  if (payload.expectedTurn < state.turn) {
    const staleView = toEpisodeView(state, actionMap, imageMap, requestTimestamp);
    return context.json({
      stale: true,
      confidence: 1,
      decision: 'review',
      interpretedActionId: null,
      interpretedActionName: null,
      message: 'Command state is stale. Syncing latest turn context.',
      suggestions: [],
      episode: {
        ...staleView,
        briefing: await polisher.polish(staleView.briefing)
      }
    });
  }

  const offeredActions = state.offeredActionIds
    .map((actionId) => actionMap.get(actionId))
    .filter((action): action is ActionDefinition => Boolean(action));
  const interpretation = interpretCommandText(payload.commandText, offeredActions);
  const currentView = toEpisodeView(state, actionMap, imageMap, requestTimestamp);
  const scenario = getScenario(state.scenarioId);
  const roleLabel = scenario.role || 'Command';

  const confidencePercent = Math.round(interpretation.confidence * 100);
  const message = buildInterpretationMessage({
    decision: interpretation.decision,
    confidencePercent,
    interpretedActionName: interpretation.interpretedActionName,
    suggestions: interpretation.suggestions,
    roleLabel
  });

  return context.json({
    stale: false,
    confidence: interpretation.confidence,
    decision: interpretation.decision,
    interpretedActionId: interpretation.interpretedActionId,
    interpretedActionName: interpretation.interpretedActionName,
    message,
    suggestions: interpretation.suggestions,
    episode: {
      ...currentView,
      briefing: await polisher.polish(currentView.briefing)
    }
  });
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
  const adversaryProfile = getScenarioAdversaryProfile(scenario.id);
  const engineContext = {
    scenario,
    adversaryProfile,
    actions,
    images,
    debriefVariants
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
    const beatProgressPayload = {
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
    } as const;

    const persistence = await persistResolvedTurnAtomic(context.env.DB, {
      episodeId,
      expectedTurn: payload.expectedTurn,
      expectedStateJson: episodeRecord.stateJson,
      nextState,
      resolution,
      beatProgress: beatProgressPayload,
      endedAt: nextState.status === 'completed' ? new Date(requestTimestamp).toISOString() : null
    });

    if (!persistence.updated) {
      const latest = await getEpisodeStateById(db, episodeId);
      if (!latest) {
        return context.json({ message: 'Episode no longer available' }, 404);
      }

      return context.json({
        stale: true,
        episode: toEpisodeView(latest, actionMap, imageMap, requestTimestamp)
      });
    }

    if (nextState.status === 'completed' && nextState.outcome) {
      const report = buildPostGameReport(nextState, actionMap, {
        scenario,
        adversaryProfile,
        rivalLeader: getRivalLeader(scenario.id, adversaryProfile.id),
        deepDebrief: getDebriefDeep(scenario.id),
        causalityNarrative: getCausalityRevealForOutcome(nextState.outcome),
        advisorRetrospectives: getAdvisorRetrospectivesForOutcome(nextState.outcome)
      });
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
  const adversaryProfile = getScenarioAdversaryProfile(scenario.id);
  const engineContext = {
    scenario,
    adversaryProfile,
    actions,
    images,
    debriefVariants
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

  const beatProgressPayload = {
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
  } as const;

  const persistence = await persistResolvedTurnAtomic(context.env.DB, {
    episodeId,
    expectedTurn: payload.expectedTurn,
    expectedStateJson: episodeRecord.stateJson,
    nextState: result.nextState,
    resolution: result.resolution,
    beatProgress: beatProgressPayload,
    endedAt: result.nextState.status === 'completed' ? new Date(requestTimestamp).toISOString() : null
  });

  if (!persistence.updated) {
    const latest = await getEpisodeStateById(db, episodeId);
    if (!latest) {
      return context.json({ message: 'Episode no longer available' }, 404);
    }

    return context.json({
      stale: true,
      episode: toEpisodeView(latest, actionMap, imageMap, requestTimestamp)
    });
  }

  if (result.nextState.status === 'completed' && result.nextState.outcome) {
    const report = buildPostGameReport(result.nextState, actionMap, {
      scenario,
      adversaryProfile,
      rivalLeader: getRivalLeader(scenario.id, adversaryProfile.id),
      deepDebrief: getDebriefDeep(scenario.id),
      causalityNarrative: getCausalityRevealForOutcome(result.nextState.outcome),
      advisorRetrospectives: getAdvisorRetrospectivesForOutcome(result.nextState.outcome)
    });
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

  const beatProgressPayload = {
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
  } as const;

  const persistence = await persistEpisodeAndBeatProgressAtomic(context.env.DB, {
    episodeId,
    expectedTurn: payload.expectedTurn,
    expectedStateJson: episodeRecord.stateJson,
    nextState,
    beatProgress: beatProgressPayload,
    endedAt: nextState.status === 'completed' ? new Date(requestTimestamp).toISOString() : null
  });

  if (!persistence.updated) {
    const latest = await getEpisodeStateById(db, episodeId);
    if (!latest) {
      return context.json({ message: 'Episode no longer available' }, 404);
    }

    return context.json({
      stale: true,
      episode: toEpisodeView(latest, actionMap, imageMap, requestTimestamp)
    });
  }

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

  const scenario = getScenario(episode.scenarioId);
  const adversaryProfile = getScenarioAdversaryProfile(scenario.id);
  const narrativeOptions = episode.outcome
    ? {
        causalityNarrative: getCausalityRevealForOutcome(episode.outcome),
        advisorRetrospectives: getAdvisorRetrospectivesForOutcome(episode.outcome)
      }
    : {};
  const generated = buildPostGameReport(episode, actionMap, {
    scenario,
    adversaryProfile,
    rivalLeader: getRivalLeader(scenario.id, adversaryProfile.id),
    deepDebrief: getDebriefDeep(scenario.id),
    ...narrativeOptions
  });
  const episodeRecord = await getEpisodeState(db, episodeId);
  if (episodeRecord) {
    const reportViewTimestamp = episode.activeCountdown
      ? episode.activeCountdown.expiresAt - (episode.activeCountdown.secondsRemaining * 1000)
      : 0;
    const view = toEpisodeView(episode, actionMap, imageMap, reportViewTimestamp);
    await upsertReport(db, generated, episodeRecord.profileId, computeCompositeScore(view));
  }

  return context.json(generated);
});

app.get('/api/reference/bootstrap', (context) => {
  context.header('Cache-Control', 'public, max-age=300');
  return context.json({
    scenarios,
    adversaryProfiles,
    actions: playerActions,
    narrativeCandidates,
    intelFragments,
    newsWire,
    actionNarratives,
    cinematics,
    scenarioWorld,
    advisorDossiers,
    rivalLeaders
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
