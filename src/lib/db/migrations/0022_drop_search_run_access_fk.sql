-- Drop FK constraints on search_run_access so anonymous workspace IDs
-- (e.g. anon_xxxx) that are not in the users table can be stored.
-- The owner_id column is a logical workspace identifier, not always a user row.
DO $$
DECLARE
  v_constraint TEXT;
BEGIN
  SELECT conname INTO v_constraint
    FROM pg_constraint
   WHERE conrelid = 'search_run_access'::regclass
     AND contype = 'f'
     AND conname ILIKE '%owner%'
   LIMIT 1;
  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE search_run_access DROP CONSTRAINT %I', v_constraint);
  END IF;
END;
$$;

DO $$
DECLARE
  v_constraint TEXT;
BEGIN
  SELECT conname INTO v_constraint
    FROM pg_constraint
   WHERE conrelid = 'search_run_access'::regclass
     AND contype = 'f'
     AND conname ILIKE '%organ%'
   LIMIT 1;
  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE search_run_access DROP CONSTRAINT %I', v_constraint);
  END IF;
END;
$$;
