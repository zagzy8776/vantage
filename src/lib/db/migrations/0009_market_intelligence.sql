-- 0009_market_intelligence.sql
-- Milestone 5: Market Intelligence

CREATE TABLE IF NOT EXISTS investigation_market_syntheses (
  id text PRIMARY KEY,
  investigation_id text NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  model text,
  status text NOT NULL CHECK (status IN ('running', 'completed', 'completed_with_errors', 'failed')),
  executive_summary text,
  aggregates jsonb,
  risks jsonb,
  unknowns jsonb,
  actions jsonb,
  validation_status text NOT NULL CHECK (validation_status IN ('supported', 'requires_review', 'rejected', 'legacy')),
  validation_issues jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS investigation_market_syntheses_investigation_idx ON investigation_market_syntheses (investigation_id);
CREATE INDEX IF NOT EXISTS investigation_market_syntheses_created_at_idx ON investigation_market_syntheses (created_at);
CREATE INDEX IF NOT EXISTS investigation_market_syntheses_status_idx ON investigation_market_syntheses (status);
CREATE UNIQUE INDEX IF NOT EXISTS investigation_market_syntheses_one_running_idx
  ON investigation_market_syntheses (investigation_id)
  WHERE status = 'running';

CREATE TABLE IF NOT EXISTS investigation_market_patterns (
  id text PRIMARY KEY,
  investigation_id text NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  synthesis_id text NOT NULL REFERENCES investigation_market_syntheses(id) ON DELETE CASCADE,
  title text NOT NULL,
  summary text NOT NULL,
  pattern_type text NOT NULL CHECK (pattern_type IN ('market_pattern', 'digital_pattern', 'operational_signal', 'service_signal', 'risk_pattern', 'evidence_gap')),
  confidence integer,
  affected_business_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  claim_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  claim_type text NOT NULL CHECK (claim_type IN ('fact', 'derived', 'inference', 'unknown')),
  status text NOT NULL CHECK (status IN ('candidate', 'supported', 'requires_review', 'rejected')),
  unknowns jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS investigation_market_patterns_investigation_idx ON investigation_market_patterns (investigation_id);
CREATE INDEX IF NOT EXISTS investigation_market_patterns_synthesis_idx ON investigation_market_patterns (synthesis_id);

CREATE TABLE IF NOT EXISTS investigation_market_opportunities (
  id text PRIMARY KEY,
  investigation_id text NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  synthesis_id text NOT NULL REFERENCES investigation_market_syntheses(id) ON DELETE CASCADE,
  title text NOT NULL,
  statement text NOT NULL,
  confidence integer,
  affected_business_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  risk_summary text NOT NULL,
  status text NOT NULL CHECK (status IN ('hypothesis', 'needs_validation', 'supported', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS investigation_market_opportunities_investigation_idx ON investigation_market_opportunities (investigation_id);
CREATE INDEX IF NOT EXISTS investigation_market_opportunities_synthesis_idx ON investigation_market_opportunities (synthesis_id);