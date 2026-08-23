-- Durable Search Run recovery for serverless (Vercel Cron) execution.
-- Adds lock columns so a light sweep worker can claim and resume orphaned
-- Search Runs without duplicating work or clobbering a live worker.

ALTER TABLE search_runs ADD COLUMN IF NOT EXISTS worker_id TEXT;
ALTER TABLE search_runs ADD COLUMN IF NOT EXISTS lock_acquired_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_search_runs_recovery_status ON search_runs (status, created_at);