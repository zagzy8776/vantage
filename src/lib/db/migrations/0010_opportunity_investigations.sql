-- 0010_opportunity_investigations.sql
-- Milestone 6: objective-aware problem and service opportunity investigations

ALTER TABLE investigation_findings ADD COLUMN IF NOT EXISTS unknowns jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE investigation_opportunities ADD COLUMN IF NOT EXISTS economic_hypothesis jsonb;