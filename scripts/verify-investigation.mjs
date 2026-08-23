import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env.local");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^"|"$/g, "");
}
const sql = neon(process.env.DATABASE_URL);

const mode = process.argv[2] ?? "find-run";

if (mode === "find-run") {
  const runs = await sql`SELECT id, status, query, country, city, discovered_count, evidence_items_generated, created_at FROM search_runs WHERE status IN ('completed','completed_with_errors') ORDER BY created_at DESC LIMIT 3`;
  console.log(JSON.stringify(runs, null, 2));
} else if (mode === "verify") {
  const investigationId = process.argv[3];
  const searchRunId = process.argv[4];
  const [inv] = await sql`SELECT id, title, status, investigation_type, city, country FROM investigations WHERE id = ${investigationId}`;
  const attachedRuns = await sql`SELECT investigation_id, search_run_id, role FROM investigation_search_runs WHERE investigation_id = ${investigationId}`;
  const attachedBusinesses = await sql`SELECT COUNT(*)::int AS count FROM investigation_businesses WHERE investigation_id = ${investigationId}`;
  const sources = await sql`SELECT COUNT(*)::int AS count FROM investigation_sources WHERE investigation_id = ${investigationId}`;
  const runStillExists = await sql`SELECT id, status FROM search_runs WHERE id = ${searchRunId}`;
  const evidenceForRun = await sql`SELECT COUNT(*)::int AS count FROM evidence_items WHERE run_id = ${searchRunId}`;
  const businessTotal = await sql`SELECT COUNT(*)::int AS count FROM businesses`;
  const searchRunTotal = await sql`SELECT COUNT(*)::int AS count FROM search_runs`;
  const duplicateRunLinks = await sql`SELECT investigation_id, search_run_id, COUNT(*)::int AS c FROM investigation_search_runs GROUP BY 1,2 HAVING COUNT(*) > 1`;
  const duplicateBusinessLinks = await sql`SELECT investigation_id, business_id, COUNT(*)::int AS c FROM investigation_businesses GROUP BY 1,2 HAVING COUNT(*) > 1`;
  console.log(JSON.stringify({
    investigation: inv ?? null,
    attachedRuns,
    attachedBusinessCount: attachedBusinesses[0]?.count ?? 0,
    sourceCount: sources[0]?.count ?? 0,
    runStillExists: runStillExists[0] ?? null,
    evidenceItemsForRun: evidenceForRun[0]?.count ?? 0,
    businessTableTotal: businessTotal[0]?.count ?? 0,
    searchRunTableTotal: searchRunTableTotalSafe(searchRunTotal),
    duplicateRunLinks,
    duplicateBusinessLinks,
  }, null, 2));
}

function searchRunTableTotalSafe(rows) {
  return rows[0]?.count ?? 0;
}