-- VANTAGE baseline schema: the complete pre-Phase-5 database model.
-- This migration intentionally excludes AI, evidence, conflict, verification,
-- search-run, Tavily, Exa, and Firecrawl additions.

DO $$ BEGIN
  CREATE TYPE business_source AS ENUM ('foursquare', 'yelp', 'manual', 'import');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE lead_status AS ENUM ('discovered', 'analyzing', 'qualified', 'contacted', 'replied', 'won');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE website_status AS ENUM ('none', 'unknown', 'unreachable', 'poor', 'fair', 'good');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE business_relationship_confidence AS ENUM ('low', 'medium', 'high');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE business_relationship_status AS ENUM ('pending', 'confirmed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE website_analysis_strategy AS ENUM ('mobile', 'desktop');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE website_analysis_status AS ENUM ('success', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS canonical_businesses (
  id text PRIMARY KEY,
  signature text NOT NULL,
  name text NOT NULL,
  category text,
  country text,
  city text,
  source_count integer NOT NULL DEFAULT 1,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS canonical_business_signature_unique ON canonical_businesses (signature);
CREATE INDEX IF NOT EXISTS canonical_business_name_idx ON canonical_businesses (name);
CREATE INDEX IF NOT EXISTS canonical_business_city_idx ON canonical_businesses (city);
CREATE INDEX IF NOT EXISTS canonical_business_country_idx ON canonical_businesses (country);

CREATE TABLE IF NOT EXISTS businesses (
  id text PRIMARY KEY,
  external_id text NOT NULL,
  source business_source NOT NULL,
  canonical_business_id text REFERENCES canonical_businesses(id) ON DELETE SET NULL,
  name text NOT NULL,
  category text NOT NULL,
  address text,
  country text,
  region text,
  city text,
  area text,
  street text,
  latitude numeric(10, 6),
  longitude numeric(10, 6),
  phone text,
  website text,
  website_canonical_url text,
  website_normalized_url text,
  rating numeric(3, 2),
  review_count integer,
  price_level integer,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS business_source_external_unique ON businesses (source, external_id);
CREATE INDEX IF NOT EXISTS business_canonical_business_idx ON businesses (canonical_business_id);
CREATE INDEX IF NOT EXISTS business_source_idx ON businesses (source);
CREATE INDEX IF NOT EXISTS business_country_idx ON businesses (country);
CREATE INDEX IF NOT EXISTS business_city_idx ON businesses (city);
CREATE INDEX IF NOT EXISTS business_category_idx ON businesses (category);
CREATE INDEX IF NOT EXISTS business_website_idx ON businesses (website);
CREATE INDEX IF NOT EXISTS business_website_canonical_idx ON businesses (website_canonical_url);
CREATE INDEX IF NOT EXISTS business_website_normalized_idx ON businesses (website_normalized_url);

CREATE TABLE IF NOT EXISTS website_analyses (
  id text PRIMARY KEY,
  business_id text NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  url text NOT NULL,
  strategy website_analysis_strategy NOT NULL,
  performance_score integer,
  accessibility_score integer,
  best_practices_score integer,
  seo_score integer,
  status website_analysis_status NOT NULL,
  error_code text,
  analyzed_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS website_analysis_business_idx ON website_analyses (business_id);
CREATE INDEX IF NOT EXISTS website_analysis_business_strategy_idx ON website_analyses (business_id, strategy);
CREATE INDEX IF NOT EXISTS website_analysis_analyzed_at_idx ON website_analyses (analyzed_at);

CREATE TABLE IF NOT EXISTS business_relationships (
  id text PRIMARY KEY,
  left_business_id text NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  right_business_id text NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  confidence business_relationship_confidence NOT NULL,
  status business_relationship_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS business_relationship_pair_unique ON business_relationships (left_business_id, right_business_id);
CREATE INDEX IF NOT EXISTS business_relationship_left_idx ON business_relationships (left_business_id);
CREATE INDEX IF NOT EXISTS business_relationship_right_idx ON business_relationships (right_business_id);
CREATE INDEX IF NOT EXISTS business_relationship_confidence_idx ON business_relationships (confidence);
CREATE INDEX IF NOT EXISTS business_relationship_status_idx ON business_relationships (status);

CREATE TABLE IF NOT EXISTS leads (
  id text PRIMARY KEY,
  business_id text NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  opportunity_score integer NOT NULL,
  status lead_status NOT NULL DEFAULT 'discovered',
  website_status website_status NOT NULL DEFAULT 'none',
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS lead_business_unique ON leads (business_id);
CREATE INDEX IF NOT EXISTS lead_opportunity_score_idx ON leads (opportunity_score);
CREATE INDEX IF NOT EXISTS lead_status_idx ON leads (status);
CREATE INDEX IF NOT EXISTS lead_website_status_idx ON leads (website_status);