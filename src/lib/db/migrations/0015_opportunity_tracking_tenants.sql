ALTER TABLE tracked_entities ADD COLUMN IF NOT EXISTS owner_id text;
ALTER TABLE tracked_entities ADD COLUMN IF NOT EXISTS organization_id text;

UPDATE tracked_entities t
SET owner_id = source.owner_id,
    organization_id = source.organization_id
FROM (
  SELECT srb.business_id, MIN(sra.owner_id) AS owner_id, MIN(sra.organization_id) AS organization_id
  FROM search_run_businesses srb
  INNER JOIN search_run_access sra ON sra.search_run_id = srb.search_run_id
  WHERE sra.owner_id IS NOT NULL
  GROUP BY srb.business_id
  HAVING COUNT(DISTINCT sra.owner_id) = 1
) source
WHERE t.business_id = source.business_id
  AND t.owner_id IS NULL;

UPDATE tracked_entities
SET owner_id = 'legacy-opportunity-owner'
WHERE owner_id IS NULL;

ALTER TABLE tracked_entities ALTER COLUMN owner_id SET NOT NULL;

DROP INDEX IF EXISTS tracked_entities_business_unique;
CREATE UNIQUE INDEX IF NOT EXISTS tracked_entities_business_owner_unique ON tracked_entities (business_id, owner_id);
CREATE INDEX IF NOT EXISTS tracked_entities_owner_idx ON tracked_entities (owner_id);
CREATE INDEX IF NOT EXISTS tracked_entities_organization_idx ON tracked_entities (organization_id);
