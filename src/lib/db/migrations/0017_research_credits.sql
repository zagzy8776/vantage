-- Research credit ledger: durable, auditable allowance for discovery runs.
CREATE TABLE IF NOT EXISTS research_credit_accounts (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free',
  monthly_limit INTEGER NOT NULL DEFAULT 5 CHECK (monthly_limit >= 0),
  monthly_used INTEGER NOT NULL DEFAULT 0 CHECK (monthly_used >= 0),
  period_start TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS research_credit_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount <> 0),
  kind TEXT NOT NULL CHECK (kind IN ('reservation', 'refund', 'adjustment', 'grant')),
  search_run_id TEXT,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_research_credit_ledger_user_created
  ON research_credit_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_credit_ledger_run
  ON research_credit_ledger(search_run_id);

-- Search-run ownership is already represented by the access side-table. Credits
-- are attached to the authenticated user, so organization/team billing can be
-- added later without changing the discovery contract.
