CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  codename TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS episodes (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  scenario_id TEXT NOT NULL,
  adversary_profile_id TEXT NOT NULL,
  seed TEXT NOT NULL,
  status TEXT NOT NULL,
  current_turn INTEGER NOT NULL,
  outcome TEXT,
  state_json TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TEXT
);

CREATE TABLE IF NOT EXISTS turn_logs (
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
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (episode_id, turn_number)
);

CREATE TABLE IF NOT EXISTS reports (
  episode_id TEXT PRIMARY KEY,
  report_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scores (
  episode_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  composite_score INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (episode_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_episodes_profile ON episodes(profile_id);
CREATE INDEX IF NOT EXISTS idx_turn_logs_episode ON turn_logs(episode_id);
