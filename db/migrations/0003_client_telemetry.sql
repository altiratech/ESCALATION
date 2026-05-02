CREATE TABLE IF NOT EXISTS client_telemetry (
  id TEXT PRIMARY KEY,
  episode_id TEXT,
  scenario_id TEXT,
  event_name TEXT NOT NULL,
  turn_number INTEGER,
  elapsed_ms INTEGER,
  metadata_json TEXT NOT NULL,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_client_telemetry_episode ON client_telemetry(episode_id);
CREATE INDEX IF NOT EXISTS idx_client_telemetry_event_created ON client_telemetry(event_name, created_at);
