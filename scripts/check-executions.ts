#!/usr/bin/env node
/**
 * Check existing executions for the plan
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { getDb } = await import("../src/lib/db/index.js");
  const { investigationPlanExecutions, investigationPlanExecutionSteps } = await import("../src/lib/db/schema.js");
  const { eq, desc } = await import("drizzle-orm");
  
  const db = getDb();
  
  const PLAN_ID = "1787420042505_nlzv8fev";
  
  console.log(`Checking executions for plan ${PLAN_ID}...`);
  const executions = await db.select().from(investigationPlanExecutions)
    .where(eq(investigationPlanExecutions.planId, PLAN_ID))
    .orderBy(desc(investigationPlanExecutions.createdAt));
  
  console.log(`Found ${executions.length} executions:`);
  for (const exec of executions) {
    console.log(`  - ID: ${exec.id}, Status: ${exec.status}, Started: ${exec.startedAt}, Completed: ${exec.completedAt || "N/A"}`);
    
    // Get steps for this execution
    const steps = await db.select().from(investigationPlanExecutionSteps)
      .where(eq(investigationPlanExecutionSteps.executionId, exec.id));
    console.log(`    Steps: ${steps.length}`);
    for (const step of steps) {
      console.log(`      - ${step.planStepId}: ${step.status} (completed: ${step.completedAt || "N/A"})`);
    }
  }
}

main().catch(console.error);
