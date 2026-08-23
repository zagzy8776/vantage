DO $$ BEGIN
  CREATE TYPE ai_opportunity_level AS ENUM ('very-low', 'low', 'medium', 'high', 'very-high');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ai_analysis_status AS ENUM ('success', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_opportunity_score integer;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_opportunity_level ai_opportunity_level;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_analyzed_at timestamptz;

CREATE INDEX IF NOT EXISTS lead_ai_opportunity_score_idx ON leads (ai_opportunity_score);
CREATE INDEX IF NOT EXISTS lead_ai_opportunity_level_idx ON leads (ai_opportunity_level);

CREATE TABLE IF NOT EXISTS ai_analyses (
  id text PRIMARY KEY,
  business_id text NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  lead_id text NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  provider text NOT NULL,
  model text,
  status ai_analysis_status NOT NULL DEFAULT 'success',
  opportunity_score integer,
  opportunity_level ai_opportunity_level,
  business_summary text,
  strengths jsonb,
  weaknesses jsonb,
  opportunities jsonb,
  risks jsonb,
  recommended_services jsonb,
  evidence jsonb,
  reasoning text,
  confidence integer,
  fallback_used integer NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 1,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_analysis_business_idx ON ai_analyses (business_id);
CREATE INDEX IF NOT EXISTS ai_analysis_lead_idx ON ai_analyses (lead_id);
CREATE INDEX IF NOT EXISTS ai_analysis_created_at_idx ON ai_analyses (created_at);
CREATE INDEX IF NOT EXISTS ai_analysis_status_idx ON ai_analyses (status);