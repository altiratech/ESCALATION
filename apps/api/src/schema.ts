import { int, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  codename: text('codename').notNull().unique(),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP')
});

export const episodes = sqliteTable('episodes', {
  id: text('id').primaryKey(),
  profileId: text('profile_id').notNull(),
  scenarioId: text('scenario_id').notNull(),
  archetypeId: text('archetype_id').notNull(),
  seed: text('seed').notNull(),
  status: text('status').notNull(),
  currentTurn: int('current_turn').notNull(),
  outcome: text('outcome'),
  stateJson: text('state_json').notNull(),
  startedAt: text('started_at').notNull().default('CURRENT_TIMESTAMP'),
  endedAt: text('ended_at')
});

export const turnLogs = sqliteTable('turn_logs', {
  id: text('id').primaryKey(),
  episodeId: text('episode_id').notNull(),
  turnNumber: int('turn_number').notNull(),
  playerActionId: text('player_action_id').notNull(),
  rivalActionId: text('rival_action_id').notNull(),
  eventsJson: text('events_json').notNull(),
  beliefJson: text('belief_json').notNull(),
  visibleMetersJson: text('visible_meters_json').notNull(),
  trueMetersJson: text('true_meters_json').notNull(),
  briefingText: text('briefing_text').notNull(),
  headlinesJson: text('headlines_json').notNull(),
  imageId: text('image_id'),
  rngTraceJson: text('rng_trace_json').notNull(),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP')
});

export const reports = sqliteTable('reports', {
  episodeId: text('episode_id').primaryKey(),
  reportJson: text('report_json').notNull(),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP')
});

export const scores = sqliteTable('scores', {
  episodeId: text('episode_id').notNull(),
  profileId: text('profile_id').notNull(),
  compositeScore: int('composite_score').notNull(),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP')
}, (table) => ({
  pk: primaryKey({
    columns: [table.episodeId, table.profileId]
  })
}));
