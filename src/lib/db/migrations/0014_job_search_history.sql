CREATE TABLE IF NOT EXISTS job_search_history (
  id text PRIMARY KEY,
  owner_id text NOT NULL,
  organization_id text,
  query text NOT NULL,
  country_code text,
  country text,
  city text,
  remote boolean,
  direct_only boolean NOT NULL DEFAULT false,
  posted_within_days integer NOT NULL DEFAULT 30,
  providers jsonb,
  result_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_search_history_owner_created_idx
  ON job_search_history (owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS job_search_history_owner_query_idx
  ON job_search_history (owner_id, query);
