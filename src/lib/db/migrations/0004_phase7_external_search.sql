ALTER TYPE business_source ADD VALUE IF NOT EXISTS 'web';
ALTER TYPE evidence_source_type ADD VALUE IF NOT EXISTS 'tavily';
ALTER TYPE evidence_source_type ADD VALUE IF NOT EXISTS 'exa';
ALTER TYPE evidence_source_type ADD VALUE IF NOT EXISTS 'firecrawl';
ALTER TYPE evidence_source_type ADD VALUE IF NOT EXISTS 'pagespeed';

ALTER TABLE search_runs ADD COLUMN IF NOT EXISTS external_search_providers jsonb;
ALTER TABLE search_runs ADD COLUMN IF NOT EXISTS tavily_queries integer NOT NULL DEFAULT 0;
ALTER TABLE search_runs ADD COLUMN IF NOT EXISTS exa_queries integer NOT NULL DEFAULT 0;
ALTER TABLE search_runs ADD COLUMN IF NOT EXISTS candidates_returned integer NOT NULL DEFAULT 0;
ALTER TABLE search_runs ADD COLUMN IF NOT EXISTS candidates_promoted integer NOT NULL DEFAULT 0;
ALTER TABLE search_runs ADD COLUMN IF NOT EXISTS official_domains_identified integer NOT NULL DEFAULT 0;
ALTER TABLE search_runs ADD COLUMN IF NOT EXISTS firecrawl_enriched integer NOT NULL DEFAULT 0;
ALTER TABLE search_runs ADD COLUMN IF NOT EXISTS evidence_items_generated integer NOT NULL DEFAULT 0;
ALTER TABLE search_runs ADD COLUMN IF NOT EXISTS failures jsonb;

CREATE TABLE IF NOT EXISTS evidence_conflicts (
  id text PRIMARY KEY,
  business_id text NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  category evidence_category NOT NULL,
  field_key text NOT NULL,
  status text NOT NULL DEFAULT 'conflicting',
  items jsonb NOT NULL,
  observed_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS evidence_conflict_business_idx ON evidence_conflicts (business_id);
CREATE INDEX IF NOT EXISTS evidence_conflict_field_idx ON evidence_conflicts (category, field_key);