ALTER TABLE jobs ADD COLUMN IF NOT EXISTS owner_id text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS organization_id text;

UPDATE jobs
SET owner_id = 'legacy-jobs-owner'
WHERE owner_id IS NULL;

ALTER TABLE jobs ALTER COLUMN owner_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS jobs_owner_idx ON jobs (owner_id);
CREATE INDEX IF NOT EXISTS jobs_organization_idx ON jobs (organization_id);
CREATE INDEX IF NOT EXISTS jobs_owner_country_idx ON jobs (owner_id, country_code);

ALTER TABLE job_verification_events ADD COLUMN IF NOT EXISTS owner_id text;
UPDATE job_verification_events e
SET owner_id = j.owner_id
FROM jobs j
WHERE e.job_id = j.id
  AND e.owner_id IS NULL;
CREATE INDEX IF NOT EXISTS job_verification_events_owner_idx ON job_verification_events (owner_id);
