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
  console.log('=== DIRECT API TESTS ===\n');
  
  // Groq - test multiple current models
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey) {
    const groqModels = [
      'llama-3.2-11b-vision-preview',
      'llama-3.2-90b-text-preview', 
      'llama-3.2-3b-preview',
      'llama-3.1-70b-versatile',
      'llama-3.1-8b-instant',
      'gemma-7b-it'
    ];
    
    for (const model of groqModels) {
      await testDirect('groq', 'https://api.groq.com/openai/v1/chat/completions', groqKey, model, {
        model: model,
        messages: [{ role: 'user', content: 'OK' }],
        max_tokens: 10
      });
      console.log('---');
    }
  }
  
  console.log('\n=== CEREBRAS ===');
  const cerebrasKey = process.env.CEREBRAS_API_KEY?.trim();
  if (cerebrasKey) {
    await testDirect('cerebras', 'https://api.cerebras.ai/v1/chat/completions', cerebrasKey, 'gemma-4-31b', {
      model: 'gemma-4-31b',
      messages: [{ role: 'user', content: 'OK' }],
      max_tokens: 10
    });
    
    console.log('---');
    
    await testDirect('cerebras', 'https://api.cerebras.ai/v1/chat/completions', cerebrasKey, 'gpt-oss-120b', {
      model: 'gpt-oss-120b',
      messages: [{ role: 'user', content: 'OK' }],
      max_tokens: 10
    });
  }
  
  console.log('\n=== OPENROUTER ===');
  const openrouterKey = process.env.OPENROUTER_API_KEY?.trim();
  if (openrouterKey) {
    const orModels = [
      'mistralai/mistral-7b-instruct:free',
      'google/gemma-2-9b-it:free',
      'meta-llama/llama-3.2-3b-instruct:free',
      'microsoft/phi-3-mini-128k-instruct:free',
      'nousresearch/hermes-3-llama-3.1-8b:free'
    ];
    
    for (const model of orModels) {
      await testDirect('openrouter', 'https://openrouter.ai/api/v1/chat/completions', openrouterKey, model, {
        model: model,
        messages: [{ role: 'user', content: 'OK' }],
        max_tokens: 10
      }, { "HTTP-Referer": "http://localhost:3000", "X-Title": "VANTAGE" });
      console.log('---');
    }
  }
}

main().catch(console.error);