import { config } from "dotenv";
config({ path: ".env.local" });

import { FoursquareBusinessProvider } from "../src/providers/business/foursquare.ts";
import { YelpBusinessProvider } from "../src/providers/business/yelp.ts";
import { TavilyEvidenceSearchProvider } from "../src/providers/evidence-search/tavily.ts";
import { ExaEvidenceSearchProvider } from "../src/providers/evidence-search/exa.ts";

async function main() {
  console.log("Running Provider Diagnostics...\n");

  // Test Foursquare
  console.log("=== Foursquare ===");
  const foursquare = new FoursquareBusinessProvider();
  const fsResult = await foursquare.search({ 
    category: "Beauty salons", 
    country: "CA", 
    city: "Toronto", 
    limit: 5, 
    depth: "deep" 
  });
  console.log(`Status: ${fsResult.status}`);
  console.log(`Results: ${fsResult.results.length}`);
  console.log(`Error: ${fsResult.errorMessage ?? 'none'}`);
  console.log(`Configured: ${Boolean(process.env.FOURSQUARE_API_KEY?.trim())}`);
  console.log("");

  // Test Yelp
  console.log("=== Yelp ===");
  const yelp = new YelpBusinessProvider();
  const yelpResult = await yelp.search({ 
    category: "Beauty salons", 
    country: "CA", 
    city: "Toronto", 
    limit: 5, 
    depth: "deep" 
  });
  console.log(`Status: ${yelpResult.status}`);
  console.log(`Results: ${yelpResult.results.length}`);
  console.log(`Error: ${yelpResult.errorMessage ?? 'none'}`);
  console.log(`Configured: ${Boolean(process.env.YELP_API_KEY?.trim())}`);
  console.log("");

  // Test Tavily
  console.log("=== Tavily ===");
  const tavily = new TavilyEvidenceSearchProvider();
  const tavilyResult = await tavily.search({ 
    businessName: "beauty salon", 
    category: "Beauty salons", 
    country: "CA", 
    location: "Toronto, CA", 
    limit: 5 
  });
  console.log(`Status: ${tavilyResult.status}`);
  console.log(`Results: ${tavilyResult.results.length}`);
  console.log(`Error: ${tavilyResult.errorMessage ?? 'none'}`);
  console.log(`Configured: ${Boolean(process.env.TAVILY_API_KEY?.trim())}`);
  console.log("");

  // Test Exa
  console.log("=== Exa ===");
  const exa = new ExaEvidenceSearchProvider();
  const exaResult = await exa.search({ 
    businessName: "beauty salon", 
    category: "Beauty salons", 
    country: "CA", 
    location: "Toronto, CA", 
    limit: 5 
  });
  console.log(`Status: ${exaResult.status}`);
  console.log(`Results: ${exaResult.results.length}`);
  console.log(`Error: ${exaResult.errorMessage ?? 'none'}`);
  console.log(`Configured: ${Boolean(process.env.EXA_API_KEY?.trim())}`);
}

main().catch(console.error);