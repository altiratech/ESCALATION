import { drizzle } from 'drizzle-orm/d1';

import * as schema from './schema';

export interface Env {
  DB: D1Database;
  APP_ENV?: string;
  LLM_MODE?: 'off' | 'mock';
  LLM_API_KEY?: string;
}

export type Database = ReturnType<typeof createDb>;

export const createDb = (env: Env) => drizzle(env.DB, { schema });

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    codename TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS episodes (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    scenario_id TEXT NOT NULL,
    archetype_id TEXT NOT NULL,
    seed TEXT NOT NULL,
    status TEXT NOT NULL,
    current_turn INTEGER NOT NULL,
    outcome TEXT,
    state_json TEXT NOT NULL,
    started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS turn_logs (
    id TEXT PRIMARY KEY,
    episode_id TEXT NOT NULL,
    turn_number INTEGER NOT NULL,
    player_action_id TEXT NOT NULL,
    rival_action_id TEXT NOT NULL,
    events_json TEXT NOT NULL,
    belief_json TEXT NOT NULL,
    visible_meters_json TEXT NOT NULL,
    true_meters_json TEXT NOT NULL,
    briefing_text TEXT NOT NULL,
    headlines_json TEXT NOT NULL,
    image_id TEXT,
    rng_trace_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_turn_logs_episode_turn ON turn_logs(episode_id, turn_number)`,
  `CREATE TABLE IF NOT EXISTS beat_progress (
    id TEXT PRIMARY KEY,
    episode_id TEXT NOT NULL,
    turn_number INTEGER NOT NULL,
    beat_id_before TEXT NOT NULL,
    beat_id_after TEXT NOT NULL,
    transition_source TEXT NOT NULL,
    transitioned INTEGER NOT NULL DEFAULT 0,
    timer_mode TEXT NOT NULL,
    timer_seconds INTEGER,
    timer_seconds_remaining INTEGER,
    timer_expired INTEGER NOT NULL DEFAULT 0,
    extend_used INTEGER NOT NULL DEFAULT 0,
    extend_timer_uses_remaining INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_beat_progress_episode_turn ON beat_progress(episode_id, turn_number)`,
  `CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    episode_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    turn_number INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    advisor_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_chat_messages_episode_turn ON chat_messages(episode_id, turn_number)`,
  `CREATE TABLE IF NOT EXISTS advisor_state (
    id TEXT PRIMARY KEY,
    episode_id TEXT NOT NULL,
    advisor_id TEXT NOT NULL,
    turn_number INTEGER NOT NULL,
    mood TEXT NOT NULL,
    last_suggestion TEXT,
    last_reaction TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_advisor_state_episode_turn ON advisor_state(episode_id, turn_number)`,
  `CREATE TABLE IF NOT EXISTS llm_calls (
    id TEXT PRIMARY KEY,
    episode_id TEXT NOT NULL,
    turn_number INTEGER NOT NULL,
    job_type TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    latency_ms INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_llm_calls_episode_turn ON llm_calls(episode_id, turn_number)`,
  `CREATE TABLE IF NOT EXISTS reports (
    episode_id TEXT PRIMARY KEY,
    report_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS scores (
    episode_id TEXT NOT NULL,
    profile_id TEXT NOT NULL,
    composite_score INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (episode_id, profile_id)
  )`
];

let schemaReady = false;
let schemaReadyPromise: Promise<void> | null = null;

export const ensureSchema = async (env: Env): Promise<void> => {
  if (schemaReady) return;

  if (schemaReadyPromise) {
    await schemaReadyPromise;
    return;
  }

  schemaReadyPromise = (async () => {
    for (const statement of schemaStatements) {
      await env.DB.prepare(statement).run();
    }
    schemaReady = true;
  })();

  await schemaReadyPromise;
};
