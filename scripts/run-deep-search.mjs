import { config } from "dotenv";
config({ path: ".env.local" });

import { discoverBusinesses } from "../src/lib/discover/service.ts";

async function main() {
  console.log("=== Running Deep Search Test ===\n");
  
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
  console.log("");
  
  try {
    const result = await discoverBusinesses(query);
    
    console.log("\n=== RESULTS ===");
    console.log(`Total unique results: ${result.totalUniqueResults}`);
    console.log(`Clusters: ${result.clusters.length}`);
    console.log(`Results: ${result.results.length}`);
    console.log(`Queried providers: ${result.queriedProviders.join(", ")}`);
    console.log(`Fallback used: ${result.fallbackUsed}`);
    console.log(`Workflow:`, JSON.stringify(result.workflow, null, 2));
    console.log(`Stored IDs: ${result.storedIds.length}`);
    
    // Check verification statuses
    console.log("\n=== VERIFICATION STATUS ===");
    for (const cluster of result.clusters) {
      console.log(`  ${cluster.canonical.name}: source=${cluster.canonical.source}, website=${cluster.canonical.website ?? 'none'}, confidence=${cluster.confidence}`);
    }
    
  } catch (error) {
    console.error("Error:", error);
  }
}

main().catch(console.error);