import { config } from 'dotenv';
config({ path: '.env.local' });

import { firecrawlWebsiteResearchProvider } from "../src/providers/website-research/firecrawl.ts";

async function main() {
  console.log("=== FIRECRAWL SMOKE TEST ===\n");
  
  // Use a verified website from existing data
  const testUrl = "https://thecabinetsalon.com/";
  console.log(`Testing with URL: ${testUrl}\n`);
  
  const result = await firecrawlWebsiteResearchProvider.research({ 
    businessId: "test_biz_1", 
    url: testUrl, 
    maxPages: 3 
  });
  
  console.log(`Provider: ${result.provider}`);
  console.log(`Pages fetched: ${result.pagesFetched.length}`);
  console.log(`Evidence items: ${result.evidence.length}`);
  console.log(`Errors: ${result.errors.length}`);
  
  if (result.pagesFetched.length > 0) {
    console.log('\nPages fetched:');
    result.pagesFetched.forEach((p, i) => console.log(`  ${i+1}. ${p}`));
  }
  
  if (result.evidence.length > 0) {
    console.log('\nEvidence (first 3):');
    result.evidence.slice(0, 3).forEach((e, i) => {
      console.log(`  ${i+1}. [${e.category}] ${e.statement.substring(0, 80)}...`);
    });
  }
  
  if (result.errors.length > 0) {
    console.log('\nErrors:');
    result.errors.forEach((e, i) => console.log(`  ${i+1}. ${e}`));
  }
  
  console.log('\n=== FIRECRAWL TEST COMPLETE ===');
}

main().catch(e => console.error('Error:', e));