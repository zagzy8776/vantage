import { sql } from "drizzle-orm";
import { getDb } from "./index";

export interface PhaseMigrationStatus {
  phase5: { tables: boolean; leadColumns: boolean };
  phase6: { evidenceTable: boolean; searchRunsTable: boolean; verificationColumn: boolean };
  phase7: { conflictTable: boolean };
  phase8: { investigationsTable: boolean };
  readyForDeepDiscovery: boolean;
}

export async function getMigrationStatus(): Promise<PhaseMigrationStatus> {
  const db = getDb();
  const result = await db.execute(sql`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (table_name IN ('ai_analyses', 'evidence_items', 'search_runs', 'evidence_conflicts', 'investigations')
        OR (table_name = 'leads' AND column_name IN ('ai_opportunity_score', 'ai_opportunity_level', 'ai_analyzed_at'))
        OR (table_name = 'businesses' AND column_name = 'verification_status'))
  `);
  const rows = result.rows as Array<{ table_name: string; column_name: string }>;
  const hasTable = (table: string) => rows.some((row) => row.table_name === table);
  const hasColumn = (table: string, column: string) => rows.some((row) => row.table_name === table && row.column_name === column);
  const phase5 = { tables: hasTable("ai_analyses"), leadColumns: ["ai_opportunity_score", "ai_opportunity_level", "ai_analyzed_at"].every((column) => hasColumn("leads", column)) };
  const phase6 = { evidenceTable: hasTable("evidence_items"), searchRunsTable: hasTable("search_runs"), verificationColumn: hasColumn("businesses", "verification_status") };
  const phase7 = { conflictTable: hasTable("evidence_conflicts") };
  const phase8 = { investigationsTable: hasTable("investigations") };
  return { phase5, phase6, phase7, phase8, readyForDeepDiscovery: phase5.tables && phase5.leadColumns && phase6.evidenceTable && phase6.searchRunsTable && phase6.verificationColumn && phase7.conflictTable };
}

export async function assertDeepDiscoverySchemaReady() {
  const status = await getMigrationStatus();
  if (!status.readyForDeepDiscovery) throw new Error("Phase 5/6/7 database migrations are not fully applied. Apply the migrations in src/lib/db/migrations before deep discovery.");
}