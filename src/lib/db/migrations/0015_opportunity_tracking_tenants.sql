ALTER TABLE tracked_entities ADD COLUMN IF NOT EXISTS owner_id text;
ALTER TABLE tracked_entities ADD COLUMN IF NOT EXISTS organization_id text;

UPDATE tracked_entities
SET owner_id = 'legacy-opportunity-owner'
WHERE owner_id IS NULL;

ALTER TABLE tracked_entities ALTER COLUMN owner_id SET NOT NULL;

DROP INDEX IF EXISTS tracked_entities_business_unique;
CREATE UNIQUE INDEX IF NOT EXISTS tracked_entities_business_owner_unique ON tracked_entities (business_id, owner_id);
CREATE INDEX IF NOT EXISTS tracked_entities_owner_idx ON tracked_entities (owner_id);
CREATE INDEX IF NOT EXISTS tracked_entities_organization_idx ON tracked_entities (organization_id);
