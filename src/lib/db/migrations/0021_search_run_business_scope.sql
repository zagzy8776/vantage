-- Per-customer/run business visibility and repeat-scan exclusion.
CREATE TABLE IF NOT EXISTS search_run_businesses (
  search_run_id TEXT NOT NULL REFERENCES search_runs(id) ON DELETE CASCADE,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (search_run_id, business_id)
);

CREATE INDEX IF NOT EXISTS search_run_businesses_business_idx
  ON search_run_businesses(business_id);

CREATE INDEX IF NOT EXISTS search_run_businesses_run_idx
  ON search_run_businesses(search_run_id);

CREATE TABLE IF NOT EXISTS search_run_seen_businesses (
  owner_id TEXT NOT NULL,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  first_search_run_id TEXT REFERENCES search_runs(id) ON DELETE SET NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (owner_id, business_id)
);

CREATE INDEX IF NOT EXISTS search_run_seen_businesses_owner_idx
  ON search_run_seen_businesses(owner_id);

CREATE INDEX IF NOT EXISTS search_run_seen_businesses_business_idx
  ON search_run_seen_businesses(business_id);

-- Existing historical runs are intentionally not backfilled. New searches use
-- tenant-scoped mappings; legacy ownerless data remains isolated from customer views.
