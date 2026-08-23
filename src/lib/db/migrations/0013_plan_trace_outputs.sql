-- 0013_plan_trace_outputs.sql
-- Milestone 7: preserve synthesis/output IDs on executed plan steps

ALTER TABLE investigation_plan_execution_steps ADD COLUMN IF NOT EXISTS output_ids jsonb NOT NULL DEFAULT '[]'::jsonb;