CREATE TABLE IF NOT EXISTS agent_messages (
  id bigserial PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content_redacted text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_messages_run_idx ON agent_messages(run_id, id);

INSERT INTO schema_migrations (version) VALUES ('002_agent_messages') ON CONFLICT DO NOTHING;
