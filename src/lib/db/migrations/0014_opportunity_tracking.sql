CREATE TABLE IF NOT EXISTS tracked_entities (
  id text PRIMARY KEY,
  business_id text NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_checked_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS tracked_entities_business_unique ON tracked_entities (business_id);
CREATE INDEX IF NOT EXISTS tracked_entities_active_idx ON tracked_entities (active);
CREATE INDEX IF NOT EXISTS tracked_entities_last_checked_idx ON tracked_entities (last_checked_at);

CREATE TABLE IF NOT EXISTS entity_snapshots (
  id text PRIMARY KEY,
  tracked_entity_id text NOT NULL REFERENCES tracked_entities(id) ON DELETE CASCADE,
  observed_at timestamptz NOT NULL DEFAULT now(),
  performance_score integer,
  review_count integer,
  star_rating numeric(3,2),
  open_status boolean,
  category text
);
CREATE INDEX IF NOT EXISTS entity_snapshots_tracked_observed_idx ON entity_snapshots (tracked_entity_id, observed_at);

CREATE TABLE IF NOT EXISTS opportunity_events (
  id text PRIMARY KEY,
  tracked_entity_id text NOT NULL REFERENCES tracked_entities(id) ON DELETE CASCADE,
  old_snapshot_id text NOT NULL REFERENCES entity_snapshots(id) ON DELETE CASCADE,
  new_snapshot_id text NOT NULL REFERENCES entity_snapshots(id) ON DELETE CASCADE,
  opportunity_type text NOT NULL,
  evidence_sentence text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS opportunity_events_tracked_created_idx ON opportunity_events (tracked_entity_id, created_at);
CREATE INDEX IF NOT EXISTS opportunity_events_type_idx ON opportunity_events (opportunity_type);
CREATE UNIQUE INDEX IF NOT EXISTS opportunity_events_transition_unique ON opportunity_events (tracked_entity_id, old_snapshot_id, new_snapshot_id, opportunity_type);
