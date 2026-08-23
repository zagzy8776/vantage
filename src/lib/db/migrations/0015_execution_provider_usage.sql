-- 0015_execution_provider_usage.sql
-- Milestone 8: per-execution provider usage records for auditability.

ALTER TABLE investigation_plan_executions ADD COLUMN IF NOT EXISTS provider_usage jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS investigation_plan_executions_active_idx ON investigation_plan_executions (status, started_at);
