#!/usr/bin/env node
/**
 * Check database for existing investigations and plans
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local from the project root
config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { getDb } = await import("../src/lib/db/index.js");
  const { investigations, investigationPlans, investigationPlanSteps } = await import("../src/lib/db/schema.js");
  const { desc, eq } = await import("drizzle-orm");
  
  const db = getDb();
  
  console.log("Checking investigations...");
  const invs = await db.select().from(investigations).orderBy(desc(investigations.createdAt)).limit(10);
  console.log(`Found ${invs.length} investigations:`);
  for (const inv of invs) {
    console.log(`  - ID: ${inv.id}, Title: ${inv.title}, Status: ${inv.status}, Type: ${inv.investigationType}`);
  }
  
  console.log("\nChecking plans...");
  const plans = await db.select().from(investigationPlans).orderBy(desc(investigationPlans.createdAt)).limit(10);
  console.log(`Found ${plans.length} plans:`);
  for (const plan of plans) {
    console.log(`  - ID: ${plan.id}, Investigation: ${plan.investigationId}, Status: ${plan.status}, Version: ${plan.version}`);
    
    // Get steps for this plan
    const steps = await db.select().from(investigationPlanSteps).where(eq(investigationPlanSteps.planId, plan.id));
    console.log(`    Steps: ${steps.length}`);
    for (const step of steps) {
      console.log(`      - ${step.stepOrder}: ${step.title} (${step.type}, status: ${step.status})`);
    }
  }
}

main().catch(console.error);
