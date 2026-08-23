import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

async function main() {
  console.log("=== DEEP SEARCH #3 (with run tracking) ===\n");
  
  const query = {
    category: "Beauty salons",
    country: "CA",
    city: "Toronto",
    depth: "deep",
    limit: 10,
    searchSource: "both",
    queryExpansion: true,
    evidenceEnrichment: true,
    webDiscoveryProvider: "both",
  };
  
  console.log("Query:", JSON.stringify(query, null, 2));
  console.log("Configured production model overrides:", JSON.stringify({
    groq: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
    cerebras: process.env.CEREBRAS_MODEL || "gpt-oss-120b",
  }, null, 2));
  console.log("");

  const baseUrl = process.env.VANTAGE_APP_URL || "http://localhost:3000";
  const response = await fetch(`${baseUrl}/api/discover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(query),
  });
  const created = await response.json().catch(() => null);
  if (!response.ok || !created?.runId) throw new Error(created?.error || `Discovery request failed (${response.status}).`);
  const runId = created.runId;
  console.log(`Created search run: ${runId}\n`);

  for (let attempt = 0; attempt < 240; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 750));
    const stateResponse = await fetch(`${baseUrl}/api/discover/runs/${encodeURIComponent(runId)}`, { cache: "no-store" });
    const state = await stateResponse.json().catch(() => null);
    if (!stateResponse.ok) throw new Error(state?.error || `Run state request failed (${stateResponse.status}).`);
    if (state.status === "completed" || state.status === "completed_with_errors" || state.status === "failed") {
      console.log("\n=== RESULTS ===");
      console.log(`Status: ${state.status}`);
      console.log("Summary:", JSON.stringify(state.summary, null, 2));
      console.log("Workflow:", JSON.stringify(state.result?.workflow ?? null, null, 2));
      console.log(`Report command: node scripts/get-deep-search3-report.mjs ${runId}`);
      if (state.status === "failed") process.exitCode = 1;
      return;
    }
    if (attempt % 10 === 0) console.log(`Run status: ${state.status} (${attempt + 1}/240)`);
  }
  throw new Error(`Deep discovery did not complete within the polling window. Run ID: ${runId}`);
}

main().catch(console.error);