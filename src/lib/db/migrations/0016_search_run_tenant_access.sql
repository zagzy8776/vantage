-- Tenant isolation for durable discovery runs.
CREATE TABLE IF NOT EXISTS search_run_access (
  search_run_id TEXT PRIMARY KEY,
  owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS search_run_access_owner_idx ON search_run_access(owner_id);
CREATE INDEX IF NOT EXISTS search_run_access_org_idx ON search_run_access(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS search_run_access_owner_run_unique ON search_run_access(owner_id, search_run_id);
