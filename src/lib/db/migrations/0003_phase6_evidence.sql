DO $$ BEGIN
  CREATE TYPE business_verification_status AS ENUM ('verified', 'likely', 'uncertain', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE evidence_category AS ENUM ('business_identity', 'business_category', 'location', 'contact', 'website', 'services', 'products', 'pricing', 'booking', 'ecommerce', 'social_presence', 'opening_hours', 'about', 'technology', 'customer_signal', 'brand_signal', 'content_signal');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE evidence_source_type AS ENUM ('foursquare', 'yelp', 'website', 'public_page', 'search_result');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE evidence_confidence AS ENUM ('high', 'medium', 'low');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE search_depth AS ENUM ('quick', 'standard', 'deep');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS verification_status business_verification_status NOT NULL DEFAULT 'uncertain';

CREATE TABLE IF NOT EXISTS evidence_items (
  id text PRIMARY KEY,
  business_id text NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  category evidence_category NOT NULL,
  statement text NOT NULL,
  value text,
  source_type evidence_source_type NOT NULL,
  source_url text,
  confidence evidence_confidence NOT NULL,
  observed_at timestamptz NOT NULL,
  metadata jsonb
);

CREATE INDEX IF NOT EXISTS evidence_item_business_idx ON evidence_items (business_id);
CREATE INDEX IF NOT EXISTS evidence_item_category_idx ON evidence_items (category);
CREATE INDEX IF NOT EXISTS evidence_item_observed_at_idx ON evidence_items (observed_at);

CREATE TABLE IF NOT EXISTS search_runs (
  id text PRIMARY KEY,
  query text NOT NULL,
  country text NOT NULL,
  city text,
  depth search_depth NOT NULL,
  query_expansion integer NOT NULL DEFAULT 0,
  evidence_enrichment integer NOT NULL DEFAULT 0,
  providers jsonb,
  discovered_count integer NOT NULL DEFAULT 0,
  enriched_count integer NOT NULL DEFAULT 0,
  verified_count integer NOT NULL DEFAULT 0,
  rejected_count integer NOT NULL DEFAULT 0,
  duration_ms integer,
  status text NOT NULL DEFAULT 'completed',
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS search_run_created_at_idx ON search_runs (created_at);
CREATE INDEX IF NOT EXISTS search_run_depth_idx ON search_runs (depth);