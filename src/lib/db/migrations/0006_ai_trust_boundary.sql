ALTER TABLE ai_analyses ADD COLUMN IF NOT EXISTS unknowns jsonb;
ALTER TABLE ai_analyses ADD COLUMN IF NOT EXISTS validation_status text NOT NULL DEFAULT 'legacy';
ALTER TABLE ai_analyses ADD COLUMN IF NOT EXISTS validation_issues jsonb;

CREATE INDEX IF NOT EXISTS ai_analysis_validation_status_idx ON ai_analyses (validation_status);