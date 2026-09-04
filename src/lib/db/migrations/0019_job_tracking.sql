CREATE TABLE IF NOT EXISTS job_tracking (
  id text PRIMARY KEY,
  job_id text NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  owner_id text NOT NULL,
  organization_id text,
  status text NOT NULL DEFAULT 'saved',
  notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (job_id, owner_id)
);

CREATE INDEX IF NOT EXISTS job_tracking_owner_idx ON job_tracking (owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS job_tracking_status_idx ON job_tracking (owner_id, status);
