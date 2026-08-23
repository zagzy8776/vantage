import { config } from 'dotenv';
config({ path: '.env.local' });

import { aiProviderRegistry } from "../src/providers/ai/registry.ts";

async function testProvider(providerId, model) {
  const provider = aiProviderRegistry[providerId];
  if (!provider) return { provider: providerId, error: 'Provider not found' };
  
  console.log(`\n=== Testing ${providerId} ${model ? `(${model})` : ''} ===`);
  
  const testRequest = {
    messages: [{ role: "user", content: "Return the word: OK" }],
    temperature: 0,
    maxTokens: 10,
    model: model
  };
  
  try {
    const start = Date.now();
    const result = await provider.generate(testRequest);
    const elapsed = Date.now() - start;
    
    return {
      provider: providerId,
      success: true,
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
  console.log('=== AI DIRECT SMOKE TESTS WITH MODEL OVERRIDES ===\n');
  
  // Test Groq with different models
  console.log('--- Groq Tests ---');
  await testProvider('groq', 'llama-3.1-70b-versatile');
  await testProvider('groq', 'llama-3.1-8b-instant');
  await testProvider('groq', 'mixtral-8x7b-32768');
  await testProvider('groq', 'gemma2-9b-it');
  
  // Test Cerebras
  console.log('\n--- Cerebras Tests ---');
  await testProvider('cerebras', 'llama3.1-70b');
  await testProvider('cerebras', 'llama3.1-8b');
  
  // Test Together with correct model
  console.log('\n--- Together Tests ---');
  await testProvider('together', 'meta-llama/Llama-3.3-70B-Instruct-Turbo');
  await testProvider('together', 'meta-llama/Llama-3.1-70B-Instruct-Turbo');
  
  // Test OpenRouter
  console.log('\n--- OpenRouter Tests ---');
  await testProvider('openrouter', 'openai/gpt-4o-mini');
  await testProvider('openrouter', 'anthropic/claude-3-haiku');
}

main().catch(console.error);