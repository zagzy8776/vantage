import { config } from 'dotenv';
config({ path: '.env.local' });

import { pageSpeedAnalysisProvider } from "../src/services/website-analysis/pagespeed.ts";

async function main() {
  console.log("=== PAGESPEED SMOKE TEST ===\n");
  
  // Use a verified website from existing data
  const testUrl = "https://thecabinetsalon.com/";
  console.log(`Testing with URL: ${testUrl}\n`);
  
  // Test mobile strategy
  console.log("--- Mobile Strategy ---");
  const mobileResult = await pageSpeedAnalysisProvider.analyze({ 
    businessId: "test_biz_1", 
    url: testUrl, 
    strategy: "mobile", 
    force: true 
  });
  
  console.log(`Status: ${mobileResult.status}`);
  console.log(`Error code: ${mobileResult.errorCode ?? 'none'}`);
  console.log(`Performance: ${mobileResult.performanceScore ?? 'N/A'}`);
  console.log(`Accessibility: ${mobileResult.accessibilityScore ?? 'N/A'}`);
  console.log(`Best Practices: ${mobileResult.bestPracticesScore ?? 'N/A'}`);
  console.log(`SEO: ${mobileResult.seoScore ?? 'N/A'}`);
  console.log(`Final URL: ${mobileResult.finalUrl ?? 'N/A'}`);
  console.log(`Analyzed at: ${mobileResult.analyzedAt}`);
  
  // Test desktop strategy
  console.log("\n--- Desktop Strategy ---");
  const desktopResult = await pageSpeedAnalysisProvider.analyze({ 
    businessId: "test_biz_1", 
    url: testUrl, 
    strategy: "desktop", 
    force: true 
  });
  
  console.log(`Status: ${desktopResult.status}`);
  console.log(`Error code: ${desktopResult.errorCode ?? 'none'}`);
  console.log(`Performance: ${desktopResult.performanceScore ?? 'N/A'}`);
  console.log(`Accessibility: ${desktopResult.accessibilityScore ?? 'N/A'}`);
  console.log(`Best Practices: ${desktopResult.bestPracticesScore ?? 'N/A'}`);
  console.log(`SEO: ${desktopResult.seoScore ?? 'N/A'}`);
  console.log(`Final URL: ${desktopResult.finalUrl ?? 'N/A'}`);
  console.log(`Analyzed at: ${desktopResult.analyzedAt}`);
  
  console.log('\n=== PAGESPEED TEST COMPLETE ===');
}

main().catch(e => console.error('Error:', e));