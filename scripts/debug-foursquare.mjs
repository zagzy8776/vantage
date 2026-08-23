import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  console.log("=== Detailed Foursquare Test ===\n");
  
  const apiKey = process.env.FOURSQUARE_API_KEY?.trim();
  if (!apiKey) {
    console.log("FOURSQUARE_API_KEY not configured");
    return;
  }
  
  console.log(`API Key: ${apiKey.substring(0, 10)}...`);
  
  const params = new URLSearchParams();
  params.set("query", "Beauty salons");
  params.set("limit", "5");
  params.set("near", "Toronto, Ontario, Canada");
  params.set("sort", "DISTANCE");
  
  const url = `https://api.foursquare.com/v3/places/search?${params.toString()}`;
  console.log(`Request URL: ${url}`);
  console.log(`Authorization: ${apiKey.substring(0, 10)}...`);
  
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", Authorization: apiKey },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    
    console.log(`Response status: ${response.status}`);
    console.log(`Response ok: ${response.ok}`);
    
    const text = await response.text();
    console.log(`Response body: ${text.substring(0, 500)}`);
    
  } catch (error) {
    console.log(`Error: ${error}`);
  }
}

main().catch(console.error);