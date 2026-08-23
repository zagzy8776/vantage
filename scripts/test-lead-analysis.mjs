import { config } from 'dotenv';
config({ path: '.env.local' });

import { aiProviderRegistry } from "../src/providers/ai/registry.ts";
import { LEAD_ANALYSIS_SYSTEM_PROMPT, buildLeadAnalysisUserPrompt } from "../src/services/intelligence/prompts/lead-analysis.ts";

async function main() {
  console.log('=== TESTING ACTUAL LEAD ANALYSIS REQUEST ===\n');
  
  // Build the actual request that lead analysis would send
  const testInput = {
    business: {
      name: "Test Salon",
      category: "Beauty salons",
      location: "Toronto, CA",
      website: "https://test.com",
      phone: "+1 416-555-0123",
      source: "web"
    },
    evidence: []
  };
  
  const request = {
    messages: [
      { role: "system", content: LEAD_ANALYSIS_SYSTEM_PROMPT },
      { role: "user", content: buildLeadAnalysisUserPrompt(testInput) },
    ],
    temperature: 0,
    maxTokens: 1800,
    responseFormat: "json",
  };
  
  console.log('Testing Groq...');
  try {
    const result = await aiProviderRegistry.groq.generate(request);
    console.log('Groq SUCCESS:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.log('Groq ERROR:', e.message);
  }
  
  console.log('\nTesting Cerebras...');
  try {
    const result = await aiProviderRegistry.cerebras.generate(request);
    console.log('Cerebras SUCCESS:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.log('Cerebras ERROR:', e.message);
  }
  
  console.log('\nTesting OpenRouter...');
  try {
    const result = await aiProviderRegistry.openrouter.generate(request);
    console.log('OpenRouter SUCCESS:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.log('OpenRouter ERROR:', e.message);
  }
}

main().catch(console.error);