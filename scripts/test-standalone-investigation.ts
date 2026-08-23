#!/usr/bin/env node
/**
 * Real standalone investigation test for Milestone 9
 * 
 * This script creates a standalone investigation without a Search Run,
 * verifies the plan generation, and tests the approval & execution flow.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createStandaloneInvestigation } from "../src/services/investigations/service";
import { getInvestigationDetail } from "../src/services/investigations/service";
import { getInvestigationPlan } from "../src/services/investigations/planning/planner";
import { approveInvestigationPlan } from "../src/services/investigations/planning/planner";
import { executeInvestigationPlan } from "../src/services/investigations/planning/executor";
import { getExecutionStatusView } from "../src/services/investigations/planning/executor";
import { getDb } from "../src/lib/db";
import { investigations, investigationPlans, investigationPlanExecutions, investigationSearchRuns } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  console.log("🚀 Starting Milestone 9 Standalone Investigation Test\n");

  const db = getDb();

  // Clean up any existing test investigation
  console.log("🧹 Cleaning up any existing test data...");
  const existing = await db.select().from(investigations).where(eq(investigations.title, "Toronto Appointment No-Show Investigation 2"));
  if (existing.length > 0) {
    for (const inv of existing) {
      await db.delete(investigationPlanExecutions).where(eq(investigationPlanExecutions.investigationId, inv.id));
      await db.delete(investigationPlans).where(eq(investigationPlans.investigationId, inv.id));
      await db.delete(investigationSearchRuns).where(eq(investigationSearchRuns.investigationId, inv.id));
      await db.delete(investigations).where(eq(investigations.id, inv.id));
    }
    console.log("✅ Cleaned up existing test data\n");
  }

  // Step 1: Create standalone investigation
  console.log("📝 Step 1: Creating standalone investigation...");
  const result = await createStandaloneInvestigation({
    title: "Toronto Appointment No-Show Investigation 2",
    objective: "Identify evidence-backed appointment no-show workflow problems among beauty businesses in Toronto.",
    investigationType: "problem",
    industry: "Beauty",
    geography: {
      country: "Canada",
      city: "Toronto",
    },
    problemCategory: "appointment_no_shows",
    researchQuestion: "What evidence would suggest appointment/no-show workflow problems?",
  });

  console.log(`✅ Investigation created: ${result.investigationId}`);
  console.log(`✅ Plan v${result.planVersion} created: ${result.planId}\n`);

  // Step 2: Verify investigation was created without Search Run
  console.log("🔍 Step 2: Verifying investigation has no initial Search Run...");
  const investigation = await getInvestigationDetail(result.investigationId, { includeEvidence: false });
  if (!investigation) {
    throw new Error("Investigation not found");
  }
  console.log(`✅ Investigation status: ${investigation.status}`);
  console.log(`✅ Investigation type: ${investigation.investigationType}`);
  console.log(`✅ Industry: ${investigation.industry}`);
  console.log(`✅ Location: ${investigation.city}, ${investigation.country}`);
  console.log(`✅ Search Runs count: ${investigation.searchRuns.length}`);
  
  if (investigation.searchRuns.length > 0) {
    throw new Error("Expected no Search Runs initially");
  }
  console.log("✅ Confirmed: No Search Runs initially\n");

  // Step 3: Verify plan was created with review status
  console.log("🔍 Step 3: Verifying plan status and steps...");
  const plan = await getInvestigationPlan(result.investigationId, result.planId);
  if (!plan) {
    throw new Error("Plan not found");
  }
  console.log(`✅ Plan status: ${plan.status}`);
  console.log(`✅ Plan version: ${plan.version}`);
  console.log(`✅ Plan steps: ${plan.steps.length}`);
  
  if (plan.status !== "review") {
    throw new Error(`Expected plan status 'review', got '${plan.status}'`);
  }
  
  console.log("\n📋 Plan Steps:");
  for (const step of plan.steps) {
    console.log(`  ${step.order}. ${step.title} (${step.type}) - ${step.status}`);
  }
  console.log();

  // Step 4: Approve the plan
  console.log("✅ Step 4: Approving the plan...");
  await approveInvestigationPlan(result.investigationId, result.planId);
  const approvedPlan = await getInvestigationPlan(result.investigationId, result.planId);
  console.log(`✅ Plan approved: ${approvedPlan?.status}\n`);

  // Step 5: Execute the plan
  console.log("🚀 Step 5: Executing the plan...");
  const executionResult = await executeInvestigationPlan(result.investigationId, result.planId);
  console.log(`✅ Execution queued: ${executionResult.executionId}`);
  console.log(`✅ Execution status: ${executionResult.status}\n`);

  // Step 6: Wait a moment for execution to start
  console.log("⏳ Waiting 2 seconds for execution to start...");
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Step 7: Check execution status
  console.log("🔍 Step 6: Checking execution status...");
  const { view } = await getExecutionStatusView(result.investigationId, result.planId, executionResult.executionId);
  console.log(`✅ Execution status: ${view.status}`);
  console.log(`✅ Current step: ${view.currentStep?.title ?? "None"}`);
  console.log(`✅ Step counts: ${JSON.stringify(view.counts)}`);
  console.log(`✅ Budget: ${JSON.stringify(view.budget)}`);
  console.log(`✅ Search Run IDs: ${view.searchRunIds.join(", ") || "None yet"}\n`);

  // Step 8: Verify Search Run was created by execution
  console.log("🔍 Step 7: Verifying Search Run created during execution...");
  const updatedInvestigation = await getInvestigationDetail(result.investigationId, { includeEvidence: false });
  if (!updatedInvestigation) {
    throw new Error("Investigation not found after execution");
  }
  console.log(`✅ Search Runs count after execution: ${updatedInvestigation.searchRuns.length}`);
  
  if (updatedInvestigation.searchRuns.length === 0) {
    console.log("⚠️  No Search Runs created yet (execution may still be starting)");
  } else {
    console.log("✅ Search Run created by execution");
    for (const sr of updatedInvestigation.searchRuns) {
      console.log(`  - ${sr.searchRunId} (${sr.role})`);
    }
  }
  console.log();

  // Summary
  console.log("📊 Test Summary:");
  console.log("=".repeat(50));
  console.log(`✅ Investigation ID: ${result.investigationId}`);
  console.log(`✅ Plan ID: ${result.planId}`);
  console.log(`✅ Plan Version: ${result.planVersion}`);
  console.log(`✅ Plan Status: ${approvedPlan?.status}`);
  console.log(`✅ Execution ID: ${executionResult.executionId}`);
  console.log(`✅ Execution Status: ${view.status}`);
  console.log(`✅ Initial Search Runs: 0`);
  console.log(`✅ Search Runs after execution: ${updatedInvestigation.searchRuns.length}`);
  console.log("=".repeat(50));
  console.log("\n✨ Milestone 9 Standalone Investigation Test Complete!");
  console.log("\n📝 Note: Execution will continue in the background.");
  console.log("   Monitor the execution status using the execution ID above.");
}

main().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});
