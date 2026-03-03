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
  adversaryProfileId: text('adversary_profile_id').notNull(),
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

export const beatProgress = sqliteTable('beat_progress', {
  id: text('id').primaryKey(),
  episodeId: text('episode_id').notNull(),
  turnNumber: int('turn_number').notNull(),
  beatIdBefore: text('beat_id_before').notNull(),
  beatIdAfter: text('beat_id_after').notNull(),
  transitionSource: text('transition_source').notNull(),
  transitioned: int('transitioned').notNull().default(0),
  timerMode: text('timer_mode').notNull(),
  timerSeconds: int('timer_seconds'),
  timerSecondsRemaining: int('timer_seconds_remaining'),
  timerExpired: int('timer_expired').notNull().default(0),
  extendUsed: int('extend_used').notNull().default(0),
  extendTimerUsesRemaining: int('extend_timer_uses_remaining').notNull(),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP')
});

export const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey(),
  episodeId: text('episode_id').notNull(),
  messageId: text('message_id').notNull(),
  role: text('role').notNull(),
  content: text('content').notNull(),
  turnNumber: int('turn_number').notNull(),
  timestamp: int('timestamp').notNull(),
  advisorId: text('advisor_id'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP')
});

export const advisorState = sqliteTable('advisor_state', {
  id: text('id').primaryKey(),
  episodeId: text('episode_id').notNull(),
  advisorId: text('advisor_id').notNull(),
  turnNumber: int('turn_number').notNull(),
  mood: text('mood').notNull(),
  lastSuggestion: text('last_suggestion'),
  lastReaction: text('last_reaction'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP')
});

export const llmCalls = sqliteTable('llm_calls', {
  id: text('id').primaryKey(),
  episodeId: text('episode_id').notNull(),
  turnNumber: int('turn_number').notNull(),
  jobType: text('job_type').notNull(),
  model: text('model').notNull(),
  inputTokens: int('input_tokens').notNull(),
  outputTokens: int('output_tokens').notNull(),
  latencyMs: int('latency_ms').notNull(),
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
