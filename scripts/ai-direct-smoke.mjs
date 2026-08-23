import { config } from 'dotenv';
config({ path: '.env.local' });

import { aiProviderRegistry } from "../src/providers/ai/registry.ts";

async function testProvider(providerId) {
  const provider = aiProviderRegistry[providerId];
  if (!provider) return { provider: providerId, error: 'Provider not found' };
  
  console.log(`\n=== Testing ${providerId} ===`);
  
  const testRequest = {
    messages: [{ role: "user", content: "Return the word: OK" }],
    temperature: 0,
    maxTokens: 10,
  };
  
  try {
    const start = Date.now();
    const result = await provider.generate(testRequest);
    const elapsed = Date.now() - start;
    
    return {
      provider: providerId,
      success: true,
      httpStatus: 200,
      model: result.model,
      content: result.content.substring(0, 100),
      elapsed,
      usage: result.usage
    };
  } catch (error) {
    const err = error;
    return {
      provider: providerId,
      success: false,
      error: err.message,
      status: err.status,
      retryable: err.retryable
    };
  }
}

async function main() {
  console.log('=== AI DIRECT SMOKE TESTS ===\n');
  
  // Test Groq
  const groqResult = await testProvider('groq');
  console.log('Groq:', JSON.stringify(groqResult, null, 2));
  
  // Test Cerebras (not configured)
  console.log('\n=== Testing cerebras ===');
  console.log('CEREBRAS_API_KEY configured:', !!process.env.CEREBRAS_API_KEY?.trim());
  
  // Test Together
  const togetherResult = await testProvider('together');
  console.log('Together:', JSON.stringify(togetherResult, null, 2));
  
  // Test OpenRouter
  const openrouterResult = await testProvider('openrouter');
  console.log('OpenRouter:', JSON.stringify(openrouterResult, null, 2));
  
  // Test MiniMax
  const minimaxResult = await testProvider('minimax');
  console.log('MiniMax:', JSON.stringify(minimaxResult, null, 2));
  
  // Test Pollinations
  const pollinationsResult = await testProvider('pollinations');
  console.log('Pollinations:', JSON.stringify(pollinationsResult, null, 2));
}

main().catch(console.error);