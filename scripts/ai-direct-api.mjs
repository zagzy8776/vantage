import { config } from 'dotenv';
config({ path: '.env.local' });

async function testDirect(provider, url, apiKey, model, body) {
  console.log(`Testing ${provider} with model ${model}...`);
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${apiKey}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    const text = await response.text();
    console.log(`${provider} (${model}): ${response.status} - ${text.substring(0, 200)}`);
    return { provider, model, status: response.status, success: response.ok };
  } catch (e) {
    clearTimeout(timeout);
    console.log(`${provider} (${model}): ERROR - ${e.message}`);
    return { provider, model, error: e.message };
  }
}

async function main() {
  console.log('=== DIRECT API TESTS ===\n');
  
  // Groq
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey) {
    await testDirect('groq', 'https://api.groq.com/openai/v1/chat/completions', groqKey, 'llama-3.1-8b-instant', {
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: 'OK' }],
      max_tokens: 10
    });
    
    await testDirect('groq', 'https://api.groq.com/openai/v1/chat/completions', groqKey, 'llama-3.1-70b-versatile', {
      model: 'llama-3.1-70b-versatile',
      messages: [{ role: 'user', content: 'OK' }],
      max_tokens: 10
    });
    
    await testDirect('groq', 'https://api.groq.com/openai/v1/chat/completions', groqKey, 'mixtral-8x7b-32768', {
      model: 'mixtral-8x7b-32768',
      messages: [{ role: 'user', content: 'OK' }],
      max_tokens: 10
    });
  }
  
  // Cerebras
  const cerebrasKey = process.env.CEREBRAS_API_KEY?.trim();
  if (cerebrasKey) {
    await testDirect('cerebras', 'https://api.cerebras.ai/v1/chat/completions', cerebrasKey, 'llama3.1-70b', {
      model: 'llama3.1-70b',
      messages: [{ role: 'user', content: 'OK' }],
      max_tokens: 10
    });
    
    await testDirect('cerebras', 'https://api.cerebras.ai/v1/chat/completions', cerebrasKey, 'llama3.1-8b', {
      model: 'llama3.1-8b',
      messages: [{ role: 'user', content: 'OK' }],
      max_tokens: 10
    });
  }
  
  // Together
  const togetherKey = process.env.TOGETHER_API_KEY?.trim();
  if (togetherKey) {
    await testDirect('together', 'https://api.together.ai/v1/chat/completions', togetherKey, 'meta-llama/Llama-3.1-70B-Instruct-Turbo', {
      model: 'meta-llama/Llama-3.1-70B-Instruct-Turbo',
      messages: [{ role: 'user', content: 'OK' }],
      max_tokens: 10
    });
  }
  
  // OpenRouter
  const openrouterKey = process.env.OPENROUTER_API_KEY?.trim();
  if (openrouterKey) {
    await testDirect('openrouter', 'https://openrouter.ai/api/v1/chat/completions', openrouterKey, 'openai/gpt-4o-mini', {
      model: 'openai/gpt-4o-mini',
      messages: [{ role: 'user', content: 'OK' }],
      max_tokens: 10
    }, { "HTTP-Referer": "http://localhost:3000", "X-Title": "VANTAGE" });
  }
}

main().catch(console.error);