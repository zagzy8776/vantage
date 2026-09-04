CREATE TABLE IF NOT EXISTS jobs (
  id text PRIMARY KEY,
  provider text NOT NULL,
  provider_job_id text NOT NULL,
  title text NOT NULL,
  company_name text NOT NULL,
  company_domain text,
  description text,
  location text,
  country_code text,
  city text,
  employment_type text,
  remote boolean,
  salary_min integer,
  salary_max integer,
  salary_currency text,
  posted_at timestamptz,
  last_seen_at timestamptz,
  apply_url text,
  source_url text,
  source_name text,
  requirements jsonb,
  verification_status text NOT NULL DEFAULT 'unverified',
  verification_score integer NOT NULL DEFAULT 0,
  verification_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  verification_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  direct_employer boolean,
  stale boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS jobs_provider_job_unique ON jobs (provider, provider_job_id);
CREATE INDEX IF NOT EXISTS jobs_company_idx ON jobs (company_name);
CREATE INDEX IF NOT EXISTS jobs_country_idx ON jobs (country_code);
CREATE INDEX IF NOT EXISTS jobs_verification_status_idx ON jobs (verification_status);
CREATE INDEX IF NOT EXISTS jobs_posted_at_idx ON jobs (posted_at);
CREATE INDEX IF NOT EXISTS jobs_stale_idx ON jobs (stale);

CREATE TABLE IF NOT EXISTS job_verification_events (
  id text PRIMARY KEY,
  job_id text NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  status text NOT NULL,
  score integer NOT NULL,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS job_verification_events_job_observed_idx ON job_verification_events (job_id, observed_at);
