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
    const success = response.ok;
    console.log(`${provider} (${model}): ${response.status} - ${success ? 'SUCCESS' : text.substring(0, 200)}`);
    return { provider, model, status: response.status, success };
  } catch (e) {
    console.log(`${provider} (${model}): ERROR - ${e.message}`);
    return { provider, model, error: e.message };
  }
}

async function main() {
  console.log('=== FINDING WORKING MODELS ===\n');
  
  // Groq - test current naming format
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey) {
    console.log('\n--- GROQ ---');
    const groqModels = [
      'llama3-70b-8192',
      'llama3-8b-8192',
      'llama-3.3-70b-versatile',
      'llama-3.1-70b-versatile',
      'llama-3.1-8b-instant',
      'gemma-7b-it',
      'gemma2-9b-it',
      'mixtral-8x7b-32768'
    ];
    
    for (const model of groqModels) {
      await testDirect('groq', 'https://api.groq.com/openai/v1/chat/completions', groqKey, model, {
        model: model,
        messages: [{ role: 'user', content: 'OK' }],
        max_tokens: 10
      });
    }
  }
  
  console.log('\n--- CEREBRAS (both work) ---');
  const cerebrasKey = process.env.CEREBRAS_API_KEY?.trim();
  if (cerebrasKey) {
    await testDirect('cerebras', 'https://api.cerebras.ai/v1/chat/completions', cerebrasKey, 'gemma-4-31b', {
      model: 'gemma-4-31b',
      messages: [{ role: 'user', content: 'OK' }],
      max_tokens: 10
    });
    
    await testDirect('cerebras', 'https://api.cerebras.ai/v1/chat/completions', cerebrasKey, 'gpt-oss-120b', {
      model: 'gpt-oss-120b',
      messages: [{ role: 'user', content: 'OK' }],
      max_tokens: 10
    });
  }
  
  console.log('\n--- OPENROUTER ---');
  const openrouterKey = process.env.OPENROUTER_API_KEY?.trim();
  if (openrouterKey) {
    const orModels = [
      'meta-llama/llama-3.2-3b-instruct:free',
      'meta-llama/llama-3.1-8b-instruct:free',
      'mistralai/mistral-7b-instruct:free',
      'google/gemma-2-9b-it:free',
      'microsoft/phi-3-mini-128k-instruct:free',
      'nousresearch/hermes-3-llama-3.1-8b:free',
      'meta-llama/llama-3.1-8b-instruct',
      'google/gemma-2-9b-it'
    ];
    
    for (const model of orModels) {
      await testDirect('openrouter', 'https://openrouter.ai/api/v1/chat/completions', openrouterKey, model, {
        model: model,
        messages: [{ role: 'user', content: 'OK' }],
        max_tokens: 10
      }, { "HTTP-Referer": "http://localhost:3000", "X-Title": "VANTAGE" });
    }
  }
}

main().catch(console.error);