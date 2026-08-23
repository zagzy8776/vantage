-- 0008_investigation_synthesis.sql
-- Milestone 4: Evidence-backed Investigation Synthesis

CREATE TABLE IF NOT EXISTS investigation_syntheses (
  id text PRIMARY KEY,
  investigation_id text NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  model text,
  status text NOT NULL CHECK (status IN ('running', 'completed', 'completed_with_errors', 'failed')),
  executive_summary text,
  aggregates jsonb,
  findings jsonb,
  opportunities jsonb,
  risks jsonb,
  unknowns jsonb,
  actions jsonb,
  validation_status text NOT NULL CHECK (validation_status IN ('supported', 'requires_review', 'rejected', 'legacy')),
  validation_issues jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS investigation_syntheses_investigation_idx ON investigation_syntheses (investigation_id);
CREATE INDEX IF NOT EXISTS investigation_syntheses_created_at_idx ON investigation_syntheses (created_at);
CREATE INDEX IF NOT EXISTS investigation_syntheses_status_idx ON investigation_syntheses (status);
CREATE UNIQUE INDEX IF NOT EXISTS investigation_syntheses_one_running_idx
  ON investigation_syntheses (investigation_id)
  WHERE status = 'running';