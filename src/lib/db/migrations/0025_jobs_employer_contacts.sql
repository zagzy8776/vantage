ALTER TABLE jobs ADD COLUMN IF NOT EXISTS company_phone text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS company_email text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS company_contact_url text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS company_contact_evidence jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS jobs_company_phone_idx ON jobs(company_phone);
CREATE INDEX IF NOT EXISTS jobs_company_email_idx ON jobs(company_email);
