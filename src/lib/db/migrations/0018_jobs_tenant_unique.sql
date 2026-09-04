DROP INDEX IF EXISTS jobs_provider_job_unique;
CREATE UNIQUE INDEX IF NOT EXISTS jobs_provider_job_owner_unique ON jobs (provider, provider_job_id, owner_id);
