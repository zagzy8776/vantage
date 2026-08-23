-- 0014_durable_execution.sql
-- Milestone 8: queued, locked, resumable execution state

ALTER TABLE investigation_plan_executions ADD COLUMN IF NOT EXISTS current_step_id text;
ALTER TABLE investigation_plan_executions ADD COLUMN IF NOT EXISTS cancellation_requested integer NOT NULL DEFAULT 0;
ALTER TABLE investigation_plan_executions ADD COLUMN IF NOT EXISTS worker_id text;
ALTER TABLE investigation_plan_executions ADD COLUMN IF NOT EXISTS lock_acquired_at timestamptz;

ALTER TABLE investigation_plan_executions DROP CONSTRAINT IF EXISTS investigation_plan_executions_status_check;
ALTER TABLE investigation_plan_executions ADD CONSTRAINT investigation_plan_executions_status_check CHECK (status IN ('created', 'queued', 'running', 'completed', 'completed_with_errors', 'failed', 'cancelled'));
ALTER TABLE investigation_plan_execution_steps DROP CONSTRAINT IF EXISTS investigation_plan_execution_steps_status_check;
ALTER TABLE investigation_plan_execution_steps ADD CONSTRAINT investigation_plan_execution_steps_status_check CHECK (status IN ('planned', 'ready', 'running', 'completed', 'skipped', 'failed', 'blocked', 'cancelled'));

DROP INDEX IF EXISTS investigation_plan_executions_one_running_idx;
CREATE UNIQUE INDEX IF NOT EXISTS investigation_plan_executions_one_active_idx ON investigation_plan_executions (plan_id) WHERE status IN ('created', 'queued', 'running');
CREATE INDEX IF NOT EXISTS investigation_plan_executions_lock_idx ON investigation_plan_executions (status, lock_acquired_at);