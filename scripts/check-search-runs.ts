#!/usr/bin/env node
/**
 * Check Search Run states for the execution
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { getDb } = await import("../src/lib/db/index.js");
  const { searchRuns } = await import("../src/lib/db/schema.js");
  const { inArray } = await import("drizzle-orm");
  
  const db = getDb();
  
  const searchRunIds = ["run_1787433075312_f32ec9", "run_1787433082539_h7pnep", "run_1787433093935_mt8od6", "run_1787433101865_3h2nz3"];
  
  console.log(`Checking Search Runs for execution...`);
  const runs = await db.select().from(searchRuns).where(inArray(searchRuns.id, searchRunIds));
  
  console.log(`Found ${runs.length} Search Runs:`);
  for (const run of runs) {
    console.log(`  - ID: ${run.id}`);
    console.log(`    Status: ${run.status}`);
    console.log(`    Started: ${run.startedAt}`);
    console.log(`    Completed: ${run.completedAt || "N/A"}`);
    console.log(`    Duration: ${run.durationMs || "N/A"}ms`);
    console.log(`    Tavily queries: ${run.tavilyQueries}`);
    console.log(`    Exa queries: ${run.exaQueries}`);
    console.log(`    Firecrawl enriched: ${run.firecrawlEnriched}`);
    console.log(`    Discovered: ${run.discoveredCount}`);
    console.log(`    Candidates: ${run.candidatesReturned}`);
    console.log(`    Failures: ${JSON.stringify(run.failures)}`);
    console.log(`    Stages: ${JSON.stringify(run.stages)}`);
  }
}

main().catch(console.error);
