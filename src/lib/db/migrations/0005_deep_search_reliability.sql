ALTER TABLE search_runs ADD COLUMN IF NOT EXISTS search_source text;
ALTER TABLE search_runs ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE search_runs ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE search_runs ADD COLUMN IF NOT EXISTS stages jsonb;
ALTER TABLE search_runs ADD COLUMN IF NOT EXISTS provider_metrics jsonb;
ALTER TABLE search_runs ADD COLUMN IF NOT EXISTS result jsonb;

ALTER TABLE evidence_items ADD COLUMN IF NOT EXISTS run_id text REFERENCES search_runs(id) ON DELETE SET NULL;
ALTER TABLE website_analyses ADD COLUMN IF NOT EXISTS run_id text REFERENCES search_runs(id) ON DELETE SET NULL;
ALTER TABLE ai_analyses ADD COLUMN IF NOT EXISTS run_id text REFERENCES search_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS evidence_item_run_idx ON evidence_items (run_id);
CREATE INDEX IF NOT EXISTS website_analysis_run_idx ON website_analyses (run_id);
CREATE INDEX IF NOT EXISTS ai_analysis_run_idx ON ai_analyses (run_id);