import { config } from 'dotenv';
config({ path: '.env.local' });

async function testDirect(provider, url, apiKey, model, body) {
  console.log(`Testing ${provider} with model ${model}...`);
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  
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
    const success = response.ok;
    console.log(`${provider} (${model}): ${response.status} - ${success ? 'SUCCESS' : text.substring(0, 300)}`);
    return { provider, model, status: response.status, success, body: text };
  } catch (e) {
    console.log(`${provider} (${model}): ERROR - ${e.message}`);
    return { provider, model, error: e.message };
  }
}

async function main() {
  console.log('=== TESTING GROQ WITH DIFFERENT REQUEST FORMATS ===\n');
  
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (!groqKey) return;
  
  // Test 1: Simple request
  console.log('\n--- Test 1: Simple request ---');
  await testDirect('groq', 'https://api.groq.com/openai/v1/chat/completions', groqKey, 'openai/gpt-oss-120b', {
    model: 'openai/gpt-oss-120b',
    messages: [{ role: 'user', content: 'Return the word: OK' }],
    max_tokens: 10
  });
  
  // Test 2: With JSON response format (what the AI system uses)
  console.log('\n--- Test 2: With response_format json_object ---');
  await testDirect('groq', 'https://api.groq.com/openai/v1/chat/completions', groqKey, 'openai/gpt-oss-120b', {
    model: 'openai/gpt-oss-120b',
    messages: [{ role: 'user', content: 'Return the word: OK' }],
    max_tokens: 10,
    response_format: { type: "json_object" }
  });
  
  // Test 3: With system prompt like lead analysis
  console.log('\n--- Test 3: With system prompt ---');
  await testDirect('groq', 'https://api.groq.com/openai/v1/chat/completions', groqKey, 'openai/gpt-oss-120b', {
    model: 'openai/gpt-oss-120b',
    messages: [
      { role: 'system', content: 'You are an expert business analyst. Analyze the provided evidence and return a JSON object with opportunity_score, opportunity_level, and summary.' },
      { role: 'user', content: 'Test lead analysis' }
    ],
    max_tokens: 500,
    response_format: { type: "json_object" }
  });
  
  // Test 4: Cerebras
  console.log('\n--- Test 4: Cerebras with json_object ---');
  const cerebrasKey = process.env.CEREBRAS_API_KEY?.trim();
  if (cerebrasKey) {
    await testDirect('cerebras', 'https://api.cerebras.ai/v1/chat/completions', cerebrasKey, 'gemma-4-31b', {
      model: 'gemma-4-31b',
      messages: [{ role: 'user', content: 'Return the word: OK' }],
      max_tokens: 10,
      response_format: { type: "json_object" }
    });
  }
}

main().catch(console.error);