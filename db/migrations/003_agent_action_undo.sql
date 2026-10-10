ALTER TABLE agent_pending_actions
  DROP CONSTRAINT IF EXISTS agent_pending_actions_status_check;

ALTER TABLE agent_pending_actions
  ADD CONSTRAINT agent_pending_actions_status_check
  CHECK (status IN ('pending','confirmed','rejected','expired','failed','undone'));

ALTER TABLE agent_pending_actions
  ADD COLUMN IF NOT EXISTS undone_at timestamptz;

INSERT INTO schema_migrations (version) VALUES ('003_agent_action_undo') ON CONFLICT DO NOTHING;
