import { config } from "dotenv";
config({ path: ".env.local" });

// import { TavilyEvidenceSearchProvider } from "../src/providers/evidence-search/tavily.ts";

async function main() {
  console.log("=== Detailed Tavily Test ===\n");
  
  // Test with detailed logging by accessing the fetch directly
  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) {
    console.log("TAVILY_API_KEY not configured");
    return;
  }
  
  console.log(`API Key: ${apiKey.substring(0, 10)}...`);
  
  const searchQuery = "beauty salon Toronto CA";
  const body = JSON.stringify({ 
    query: searchQuery, 
    topic: "general", 
    search_depth: "basic", 
    max_results: 5, 
    include_answer: false, 
    include_raw_content: false, 
    include_images: false,
    // country omitted as per our fix
  });
  
  console.log(`Request body: ${body}`);
  
  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    
    console.log(`Response status: ${response.status}`);
    console.log(`Response ok: ${response.ok}`);
    
    const text = await response.text();
    console.log(`Response body: ${text}`);
    
  } catch (error) {
    console.log(`Error: ${error}`);
  }
}

main().catch(console.error);