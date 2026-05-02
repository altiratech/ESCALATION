import { z } from 'zod';

import type { GameState } from '@wargames/shared-types';

export const CURRENT_GAME_STATE_SCHEMA_VERSION = 1;

const meterStateSchema = z.object({
  economicStability: z.number(),
  energySecurity: z.number(),
  domesticCohesion: z.number(),
  militaryReadiness: z.number(),
  allianceTrust: z.number(),
  escalationIndex: z.number()
});

const partialMeterStateSchema = meterStateSchema.partial();

const latentStateSchema = z.object({
  globalLegitimacy: z.number(),
  rivalDomesticPressure: z.number(),
  playerDomesticApproval: z.number(),
  usSurgeSlack: z.number().optional(),
  munitionsDepth: z.number().optional(),
  politicalBuffer: z.number().optional(),
  taiwanResilience: z.number().optional(),
  shippingStress: z.number().optional(),
  cyberPrepositioning: z.number().optional(),
  deceptionEffectiveness: z.number().optional(),
  vulnerabilityFlags: z.array(z.string())
});

const partialLatentDeltaSchema = z.object({
  globalLegitimacy: z.number().optional(),
  rivalDomesticPressure: z.number().optional(),
  playerDomesticApproval: z.number().optional(),
  usSurgeSlack: z.number().optional(),
  munitionsDepth: z.number().optional(),
  politicalBuffer: z.number().optional(),
  taiwanResilience: z.number().optional(),
  shippingStress: z.number().optional(),
  cyberPrepositioning: z.number().optional(),
  deceptionEffectiveness: z.number().optional()
});

const beliefStateSchema = z.object({
  bluffProb: z.number(),
  thresholdHighProb: z.number(),
  economicallyWeakProb: z.number(),
  allianceFragileProb: z.number(),
  escalationVelocity: z.number(),
  deescalateUnderPressure: z.number(),
  humiliation: z.number()
});

const meterRangeSchema = z.object({
  low: z.number(),
  high: z.number(),
  confidence: z.number()
});

const meterRangeRecordSchema = z.object({
  economicStability: meterRangeSchema,
  energySecurity: meterRangeSchema,
  domesticCohesion: meterRangeSchema,
  militaryReadiness: meterRangeSchema,
  allianceTrust: meterRangeSchema,
  escalationIndex: meterRangeSchema
});

const narrativeBundleSchema = z.object({
  briefingParagraph: z.string(),
  headlines: z.array(z.string()),
  memoLine: z.string().optional(),
  tickerLine: z.string().optional()
});

const turnDebriefSchema = z.object({
  lines: z.array(z.object({
    tag: z.enum(['PlayerAction', 'SecondaryEffect', 'SystemEvent']),
    text: z.string()
  }))
});

const activeCountdownSchema = z.object({
  beatId: z.string(),
  seconds: z.number(),
  secondsRemaining: z.number(),
  expiresAt: z.number(),
  inactionBeatId: z.string(),
  inactionDeltas: partialMeterStateSchema,
  inactionNarrative: z.string(),
  extendsUsed: z.number(),
  extendsUsedCount: z.number().optional()
}).passthrough();

const delayedEffectSchema = z.object({
  id: z.string(),
  sourceActionId: z.string(),
  sourceActor: z.enum(['player', 'rival']),
  applyOnTurn: z.number(),
  chance: z.number(),
  meterDeltas: partialMeterStateSchema,
  latentDeltas: partialLatentDeltaSchema.optional(),
  description: z.string()
});

const turnHistoryEntrySchema = z.object({
  turn: z.number(),
  beatIdBefore: z.string(),
  beatIdAfter: z.string(),
  offeredActionIds: z.array(z.string()),
  playerActionId: z.string(),
  playerActionVariantId: z.string().nullable().optional(),
  playerActionVariantLabel: z.string().nullable().optional(),
  playerActionCustomLabel: z.string().nullable().optional(),
  rivalActionId: z.string(),
  meterBefore: meterStateSchema,
  meterAfter: meterStateSchema,
  visibleRanges: meterRangeRecordSchema,
  triggeredEvents: z.array(z.string()),
  beliefSnapshot: beliefStateSchema,
  narrative: narrativeBundleSchema,
  turnDebrief: turnDebriefSchema,
  selectedImageId: z.string().nullable(),
  selectedSupportingImageIds: z.array(z.string()).default([]),
  rngTrace: z.array(z.number())
});

const intelQualityStateSchema = z.object({
  byMeter: meterStateSchema,
  expiresAtTurn: z.number().int().nullable()
});

const meterLabelsSchema = z.object({
  economicStability: z.string(),
  energySecurity: z.string(),
  domesticCohesion: z.string(),
  militaryReadiness: z.string(),
  allianceTrust: z.string(),
  escalationIndex: z.string()
});

const gameStateSchema = z.object({
  schemaVersion: z.literal(CURRENT_GAME_STATE_SCHEMA_VERSION),
  id: z.string(),
  scenarioId: z.string(),
  turn: z.number().int().min(1),
  maxTurns: z.number().int().min(1),
  status: z.enum(['active', 'completed']),
  meters: meterStateSchema,
  latent: latentStateSchema,
  beliefs: beliefStateSchema,
  intelQuality: intelQualityStateSchema,
  delayedQueue: z.array(delayedEffectSchema),
  offeredActionIds: z.array(z.string()),
  recentImageIds: z.array(z.string()),
  currentBeatId: z.string(),
  beatHistory: z.array(z.string()),
  activeAdvisors: z.array(z.string()),
  scenarioRole: z.string(),
  meterLabels: meterLabelsSchema,
  timerMode: z.enum(['standard', 'relaxed', 'off']),
  extendTimerUsesRemaining: z.number().int().min(0),
  activeCountdown: activeCountdownSchema.nullable(),
  turnDebrief: turnDebriefSchema.nullable(),
  history: z.array(turnHistoryEntrySchema),
  seed: z.string(),
  rngState: z.number(),
  outcome: z.enum(['stabilization', 'frozen_conflict', 'war', 'regime_instability', 'economic_collapse']).nullable(),
  openingBriefing: narrativeBundleSchema
}).passthrough();

type ParsedStateRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is ParsedStateRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const readSchemaVersion = (parsed: ParsedStateRecord, episodeId: string): number => {
  if (parsed.schemaVersion === undefined || parsed.schemaVersion === null) {
    return 0;
  }

  if (!Number.isInteger(parsed.schemaVersion)) {
    throw new GameStateValidationError(episodeId, ['schemaVersion: Expected integer schema version']);
  }

  return parsed.schemaVersion as number;
};

const migrateGameState = (parsed: ParsedStateRecord, episodeId: string): ParsedStateRecord => {
  const sourceVersion = readSchemaVersion(parsed, episodeId);
  if (sourceVersion > CURRENT_GAME_STATE_SCHEMA_VERSION) {
    throw new GameStateValidationError(episodeId, [
      `schemaVersion: Unsupported future schema version ${sourceVersion}; current version is ${CURRENT_GAME_STATE_SCHEMA_VERSION}`
    ]);
  }

  const migrated: ParsedStateRecord = {
    ...parsed,
    schemaVersion: CURRENT_GAME_STATE_SCHEMA_VERSION
  };

  if (sourceVersion === 0) {
    // Version 0 is the pre-versioning state shape. Its only known migration is
    // stamping the current schema version before validation.
    migrated.schemaVersion = CURRENT_GAME_STATE_SCHEMA_VERSION;
  }

  return migrated;
};

export class GameStateValidationError extends Error {
  issues: string[];

  constructor(episodeId: string, issues: string[], cause?: unknown) {
    super(`Corrupt or unreadable episode state for ${episodeId}`);
    this.name = 'GameStateValidationError';
    this.issues = issues;
    this.cause = cause;
  }
}

export const parseGameStateJson = (stateJson: string, episodeId: string): GameState => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stateJson);
  } catch (error) {
    throw new GameStateValidationError(episodeId, ['Invalid JSON payload'], error);
  }

  const candidate =
    isRecord(parsed)
      ? ({
          ...migrateGameState(parsed, episodeId),
          latent: {
            usSurgeSlack: 62,
            munitionsDepth: 58,
            politicalBuffer: 54,
            taiwanResilience: 68,
            shippingStress: 36,
            cyberPrepositioning: 48,
            deceptionEffectiveness: 52,
            ...(isRecord(parsed.latent) ? parsed.latent : {})
          }
        } satisfies Record<string, unknown>)
      : parsed;

  const validated = gameStateSchema.safeParse(candidate);
  if (!validated.success) {
    throw new GameStateValidationError(
      episodeId,
      validated.error.issues.map((issue) => `${issue.path.join('.') || 'state'}: ${issue.message}`),
      validated.error
    );
  }

  return validated.data as GameState;
};
