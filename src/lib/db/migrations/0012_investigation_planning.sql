-- 0012_investigation_planning.sql
-- Milestone 7: inspectable, versioned and bounded investigation plans

CREATE TABLE IF NOT EXISTS investigation_plans (
  id text PRIMARY KEY,
  investigation_id text NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  version integer NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'review', 'approved', 'executing', 'completed', 'completed_with_errors', 'failed', 'superseded')),
  objective_snapshot jsonb NOT NULL,
  created_by text NOT NULL DEFAULT 'investigator',
  approved_at timestamptz,
  executed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (investigation_id, version)
);

CREATE TABLE IF NOT EXISTS investigation_plan_steps (
  id text PRIMARY KEY,
  plan_id text NOT NULL REFERENCES investigation_plans(id) ON DELETE CASCADE,
  step_order integer NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  objective text NOT NULL,
  reason text NOT NULL,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  dependencies jsonb NOT NULL DEFAULT '[]'::jsonb,
  budget jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'planned',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, step_order)
);

CREATE TABLE IF NOT EXISTS investigation_plan_executions (
  id text PRIMARY KEY,
  investigation_id text NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES investigation_plans(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('planned', 'running', 'completed', 'completed_with_errors', 'failed')),
  planned_budget jsonb NOT NULL DEFAULT '{}'::jsonb,
  actual_usage jsonb NOT NULL DEFAULT '{}'::jsonb,
  failure_reason text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS investigation_plan_execution_steps (
  id text PRIMARY KEY,
  execution_id text NOT NULL REFERENCES investigation_plan_executions(id) ON DELETE CASCADE,
  plan_step_id text NOT NULL REFERENCES investigation_plan_steps(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('planned', 'ready', 'running', 'completed', 'skipped', 'failed', 'blocked')),
  provider text,
  search_run_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  actual_usage jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text,
  error_category text,
  safe_message text,
  started_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS investigation_plans_investigation_idx ON investigation_plans (investigation_id);
CREATE INDEX IF NOT EXISTS investigation_plan_steps_plan_idx ON investigation_plan_steps (plan_id);
CREATE INDEX IF NOT EXISTS investigation_plan_executions_plan_idx ON investigation_plan_executions (plan_id);
CREATE INDEX IF NOT EXISTS investigation_plan_execution_steps_execution_idx ON investigation_plan_execution_steps (execution_id);
CREATE UNIQUE INDEX IF NOT EXISTS investigation_plan_executions_one_running_idx ON investigation_plan_executions (plan_id) WHERE status = 'running';