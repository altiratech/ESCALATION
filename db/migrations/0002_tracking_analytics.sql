CREATE TABLE IF NOT EXISTS beat_progress (
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
);

CREATE INDEX IF NOT EXISTS idx_beat_progress_episode_turn ON beat_progress(episode_id, turn_number);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  turn_number INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  advisor_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_episode_turn ON chat_messages(episode_id, turn_number);

CREATE TABLE IF NOT EXISTS advisor_state (
  id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL,
  advisor_id TEXT NOT NULL,
  turn_number INTEGER NOT NULL,
  mood TEXT NOT NULL,
  last_suggestion TEXT,
  last_reaction TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_advisor_state_episode_turn ON advisor_state(episode_id, turn_number);

CREATE TABLE IF NOT EXISTS llm_calls (
  id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL,
  turn_number INTEGER NOT NULL,
  job_type TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_llm_calls_episode_turn ON llm_calls(episode_id, turn_number);
