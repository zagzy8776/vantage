-- PH1B: User issuance & tenant isolation
-- Extends the 0015_auth identity tables with credential + revocation support.

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_investigation_access_investigation ON investigation_access (investigation_id);
