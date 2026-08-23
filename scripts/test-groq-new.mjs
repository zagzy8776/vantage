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
    console.log(`${provider} (${model}): ${response.status} - ${success ? 'SUCCESS' : text.substring(0, 200)}`);
    return { provider, model, status: response.status, success };
  } catch (e) {
    console.log(`${provider} (${model}): ERROR - ${e.message}`);
    return { provider, model, error: e.message };
  }
}

async function main() {
  console.log('=== TESTING GROQ WITH WORKING MODEL ===\n');
  
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey) {
    await testDirect('groq', 'https://api.groq.com/openai/v1/chat/completions', groqKey, 'openai/gpt-oss-120b', {
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'user', content: 'OK' }],
      max_tokens: 10
    });
  }
}

main().catch(console.error);