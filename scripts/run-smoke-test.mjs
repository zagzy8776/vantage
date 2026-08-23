import { config } from "dotenv";
config({ path: ".env.local" });

import { runAIProviderSmokeTest } from "../src/providers/ai/smoke-test.ts";

async function main() {
  console.log("Running AI Provider Smoke Test...\n");
  
  const results = await runAIProviderSmokeTest({
    messages: [{ role: "user", content: "Return the word: OK" }],
    temperature: 0,
    maxTokens: 10,
  });

  console.log("AI Provider Diagnostics:");
  console.log("========================\n");
  
  for (const result of results) {
    console.log(`Provider: ${result.provider}`);
    console.log(`  Configured: ${result.configured}`);
    console.log(`  Request Sent: ${result.requestSent}`);
    console.log(`  HTTP Status: ${result.httpStatus ?? 'N/A'}`);
    console.log(`  Response Parsed: ${result.responseParsed}`);
    console.log(`  Success: ${result.success}`);
    console.log(`  Error Category: ${result.errorCategory}`);
    console.log(`  Error Message: ${result.errorMessage ?? 'none'}`);
    console.log(`  Model: ${result.model ?? 'N/A'}`);
    console.log("");
  }

  const successful = results.filter(r => r.success).length;
  const total = results.filter(r => r.configured).length;
  console.log(`Summary: ${successful}/${total} configured providers succeeded`);
}

main().catch(console.error);