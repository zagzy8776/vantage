# VANTAGE database migrations

Migrations are append-only and idempotent SQL files. Apply them in order against the Neon database:

1. `0001_baseline.sql` — the reconstructed pre-Phase-5 baseline schema.
2. `0002_phase5_ai.sql` — AI analysis history and AI lead fields.
3. `0003_phase6_evidence.sql` — evidence history, verification status, and search-run records.
4. `0004_phase7_external_search.sql` — external web-source enum values, search-run metrics, and conflicts.
5. `0005_deep_search_reliability.sql` — asynchronous run lifecycle fields and run associations for evidence, website analyses, and AI analyses.
6. `0006_ai_trust_boundary.sql` — AI validation and trust-boundary fields.
7. `0007_investigations.sql` — persisted investigation workspaces and relationships.
8. `0008_investigation_synthesis.sql` — historical evidence-backed investigation synthesis results.
9. `0009_market_intelligence.sql` — historical cross-business market synthesis, patterns, and opportunity hypotheses.
10. `0010_opportunity_investigations.sql` — objective-aware finding unknowns and optional economic hypotheses.
11. `0011_opportunity_synthesis_history.sql` — append-only Problem/Service Opportunity synthesis attempts.
12. `0012_investigation_planning.sql` — versioned, reviewable investigation plans and bounded executions.
13. `0013_plan_trace_outputs.sql` — output IDs for plan execution traceability.
14. `0014_durable_execution.sql` — queued/cancellable execution lifecycle and database worker locks.
15. `0015_execution_provider_usage.sql` — per-execution provider usage records for durable execution auditing.

Phase 6/7 deep discovery calls `assertDeepDiscoverySchemaReady()` before writing evidence. This fails with a clear configuration error instead of silently assuming the production database matches the TypeScript schema.

Use `getMigrationStatus()` from a server-side development/admin check to inspect readiness. No historical rows are deleted or rewritten by these migrations.

## Migration workflow

The runtime currently uses `drizzle-orm/neon-http`. The repository did not previously include Drizzle Kit or a migration configuration, so `drizzle.config.mjs` documents the schema/output/dialect contract without replacing the runtime ORM.

For a fresh database, run `npm run db:migrate`. The runner applies the four SQL files in lexical order, supports PostgreSQL `DO $$ ... $$` blocks, and records applied filenames in `_vantage_migrations`. Do not run the Phase 5/6/7 files before `0001_baseline.sql`.

After applying the files, verify the actual database with:

```text
GET /api/system/migrations
```

The status must report `readyForDeepDiscovery: true` before running deep discovery.