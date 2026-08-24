CREATE TABLE IF NOT EXISTS search_run_access (
  search_run_id TEXT PRIMARY KEY REFERENCES search_runs(id) ON DELETE CASCADE,
  owner_id TEXT,
  organization_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS search_run_access_owner_idx ON search_run_access(owner_id);
CREATE INDEX IF NOT EXISTS search_run_access_org_idx ON search_run_access(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS search_run_access_owner_run_unique ON search_run_access(owner_id, search_run_id);

-- Existing runs are intentionally left ownerless. They are legacy data and are
-- only visible to privileged administrators until explicitly re-associated.
