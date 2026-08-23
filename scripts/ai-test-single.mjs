import { config } from 'dotenv';
config({ path: '.env.local' });

async function testDirect(provider, url, apiKey, model, body, extraHeaders = {}) {
  console.log(`Testing ${provider} with model ${model}...`);
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${apiKey}`, 
        "Content-Type": "application/json",
        ...extraHeaders
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    const text = await response.text();
    console.log(`${provider} (${model}): ${response.status} - ${text.substring(0, 300)}`);
    return { provider, model, status: response.status, success: response.ok };
  } catch (e) {
    clearTimeout(timeout);
    console.log(`${provider} (${model}): ERROR - ${e.message}`);
    return { provider, model, error: e.message };
  }
}

async function main() {
  console.log('=== DIRECT API TESTS WITH UPDATED MODELS ===\n');
  
  // Groq - test gemma2-9b-it
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey) {
    await testDirect('groq', 'https://api.groq.com/openai/v1/chat/completions', groqKey, 'gemma2-9b-it', {
      model: 'gemma2-9b-it',
      messages: [{ role: 'user', content: 'OK' }],
      max_tokens: 10
    });
  }
  
  console.log('\n---');
  
  // Cerebras - test gemma-4-31b
  const cerebrasKey = process.env.CEREBRAS_API_KEY?.trim();
  if (cerebrasKey) {
    await testDirect('cerebras', 'https://api.cerebras.ai/v1/chat/completions', cerebrasKey, 'gemma-4-31b', {
      model: 'gemma-4-31b',
      messages: [{ role: 'user', content: 'OK' }],
      max_tokens: 10
    });
  }
  
  console.log('\n---');
  
  // OpenRouter - test free model
  const openrouterKey = process.env.OPENROUTER_API_KEY?.trim();
  if (openrouterKey) {
    await testDirect('openrouter', 'https://openrouter.ai/api/v1/chat/completions', openrouterKey, 'meta-llama/llama-3.1-8b-instruct:free', {
      model: 'meta-llama/llama-3.1-8b-instruct:free',
      messages: [{ role: 'user', content: 'OK' }],
      max_tokens: 10
    }, { "HTTP-Referer": "http://localhost:3000", "X-Title": "VANTAGE" });
  }
}

main().catch(console.error);