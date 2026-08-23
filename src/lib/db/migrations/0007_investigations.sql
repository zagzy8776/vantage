-- 0007_investigations.sql
-- Milestone 2: Investigation Persistence

-- ============================================================
-- Enums
-- ============================================================

CREATE TYPE investigation_type AS ENUM (
  'company',
  'industry',
  'market',
  'problem',
  'service_opportunity'
);

CREATE TYPE investigation_status AS ENUM (
  'draft',
  'active',
  'completed',
  'archived'
);

CREATE TYPE investigation_search_run_role AS ENUM (
  'initial_discovery',
  'refresh',
  'supplemental',
  'comparison'
);

CREATE TYPE investigation_business_role AS ENUM (
  'primary',
  'comparison',
  'candidate',
  'excluded'
);

CREATE TYPE investigation_claim_type AS ENUM (
  'fact',
  'derived',
  'inference',
  'unknown'
);

CREATE TYPE investigation_claim_status AS ENUM (
  'supported',
  'requires_review',
  'rejected'
);

CREATE TYPE investigation_finding_type AS ENUM (
  'market_pattern',
  'business_pattern',
  'operational_signal',
  'digital_signal',
  'opportunity_signal',
  'risk'
);

CREATE TYPE investigation_opportunity_status AS ENUM (
  'hypothesis',
  'needs_validation',
  'supported',
  'rejected'
);

CREATE TYPE investigation_action_type AS ENUM (
  'verify',
  'interview',
  'research',
  'compare',
  'collect_data',
  'manual_review'
);

CREATE TYPE investigation_action_status AS ENUM (
  'todo',
  'in_progress',
  'completed',
  'cancelled'
);

-- ============================================================
-- Investigations table
-- ============================================================

CREATE TABLE investigations (
  id text PRIMARY KEY,
  title text NOT NULL,
  objective text NOT NULL,
  investigation_type investigation_type NOT NULL,
  status investigation_status NOT NULL DEFAULT 'draft',
  industry text,
  country text,
  region text,
  city text,
  criteria jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX investigations_status_idx ON investigations (status);
CREATE INDEX investigations_type_idx ON investigations (investigation_type);
CREATE INDEX investigations_country_city_idx ON investigations (country, city);
CREATE INDEX investigations_created_at_idx ON investigations (created_at);

-- ============================================================
-- Investigation <-> Search Run relationship
-- ============================================================

CREATE TABLE investigation_search_runs (
  investigation_id text NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  search_run_id text NOT NULL REFERENCES search_runs(id) ON DELETE CASCADE,
  role investigation_search_run_role NOT NULL DEFAULT 'initial_discovery',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (investigation_id, search_run_id)
);

CREATE INDEX investigation_search_runs_search_run_idx ON investigation_search_runs (search_run_id);

-- ============================================================
-- Investigation <-> Business relationship
-- ============================================================

CREATE TABLE investigation_businesses (
  investigation_id text NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  business_id text NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  role investigation_business_role NOT NULL DEFAULT 'primary',
  included_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (investigation_id, business_id)
);

CREATE INDEX investigation_businesses_business_idx ON investigation_businesses (business_id);

-- ============================================================
-- Investigation Sources
-- ============================================================

CREATE TABLE investigation_sources (
  id text PRIMARY KEY,
  investigation_id text NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  search_run_id text REFERENCES search_runs(id) ON DELETE SET NULL,
  provider text NOT NULL,
  source_url text,
  source_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX investigation_sources_investigation_idx ON investigation_sources (investigation_id);
CREATE INDEX investigation_sources_search_run_idx ON investigation_sources (search_run_id);

-- ============================================================
-- Investigation Claims (evidence-first core)
-- ============================================================

CREATE TABLE investigation_claims (
  id text PRIMARY KEY,
  investigation_id text NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  business_id text REFERENCES businesses(id) ON DELETE SET NULL,
  claim_type investigation_claim_type NOT NULL,
  statement text NOT NULL,
  confidence integer,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  status investigation_claim_status NOT NULL DEFAULT 'requires_review',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX investigation_claims_investigation_idx ON investigation_claims (investigation_id);
CREATE INDEX investigation_claims_business_idx ON investigation_claims (business_id);
CREATE INDEX investigation_claims_status_idx ON investigation_claims (status);

-- ============================================================
-- Investigation Findings
-- ============================================================

CREATE TABLE investigation_findings (
  id text PRIMARY KEY,
  investigation_id text NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  title text NOT NULL,
  summary text NOT NULL,
  finding_type investigation_finding_type NOT NULL,
  confidence integer,
  business_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  claim_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  status investigation_claim_status NOT NULL DEFAULT 'requires_review',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX investigation_findings_investigation_idx ON investigation_findings (investigation_id);

-- ============================================================
-- Investigation Opportunities
-- ============================================================

CREATE TABLE investigation_opportunities (
  id text PRIMARY KEY,
  investigation_id text NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  title text NOT NULL,
  statement text NOT NULL,
  confidence integer,
  business_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  risk_summary text,
  status investigation_opportunity_status NOT NULL DEFAULT 'hypothesis',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX investigation_opportunities_investigation_idx ON investigation_opportunities (investigation_id);
CREATE INDEX investigation_opportunities_status_idx ON investigation_opportunities (status);

-- ============================================================
-- Investigation Actions
-- ============================================================

CREATE TABLE investigation_actions (
  id text PRIMARY KEY,
  investigation_id text NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  priority integer NOT NULL DEFAULT 0,
  action_type investigation_action_type NOT NULL,
  status investigation_action_status NOT NULL DEFAULT 'todo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX investigation_actions_investigation_idx ON investigation_actions (investigation_id);
CREATE INDEX investigation_actions_status_idx ON investigation_actions (status);

-- ============================================================
-- Investigation Notes
-- ============================================================

CREATE TABLE investigation_notes (
  id text PRIMARY KEY,
  investigation_id text NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  author text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX investigation_notes_investigation_idx ON investigation_notes (investigation_id);