import { config } from 'dotenv';
config({ path: '.env.local' });

import { ExaEvidenceSearchProvider } from "../src/providers/evidence-search/exa.ts";

async function main() {
  console.log("=== EXA SMOKE TEST ===\n");
  
  const exa = new ExaEvidenceSearchProvider();
  const result = await exa.search({ 
    businessName: "beauty salon", 
    category: "Beauty salons", 
    country: "CA", 
    location: "Toronto, CA", 
    limit: 5 
  });
  
  console.log(`Status: ${result.status}`);
  console.log(`Results count: ${result.results.length}`);
  console.log(`Query count: ${result.queryCount}`);
  console.log(`Error: ${result.errorMessage ?? 'none'}`);
  console.log(`Provider: ${result.provider}`);
  
  if (result.results.length > 0) {
    console.log('\nSample results:');
    result.results.slice(0, 3).forEach((r, i) => {
      console.log(`  ${i+1}. ${r.title} - ${r.url}`);
    });
  }
  
  console.log('\n=== EXA TEST COMPLETE ===');
}

main().catch(e => console.error('Error:', e));