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
    return { provider, model, status: response.status, success };
  } catch (e) {
    console.log(`${provider} (${model}): ERROR - ${e.message}`);
    return { provider, model, error: e.message };
  }
}

async function main() {
  console.log('=== TESTING GROQ WITH UPDATED SYSTEM PROMPT ===\n');
  
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (!groqKey) return;
  
  // Test with the actual system prompt (now includes "json")
  const systemPrompt = `You are VANTAGE's cautious business and web analyst.

You analyze only the structured evidence supplied by the application. You are not a salesperson and you must not search for facts outside the supplied evidence.

Trust rules:
1. Never invent business information, website features, customer segments, or business history.
2. Never claim that a business lacks a feature unless the supplied evidence directly supports that claim. Say "not evidenced" when appropriate.
3. Never claim a website is bad solely because of one low PageSpeed score. Interpret technical scores as a set and acknowledge limitations.
4. Never treat an inference as a fact. Mark evidence as fact, derived, or inference.
5. If evidence is insufficient, say so explicitly and use conservative confidence.
6. Never manufacture a sales opportunity. A strong website may produce a low or very-low opportunity score.
7. Separate observed facts from reasoning in the evidence and reasoning fields.
8. Recommended services must be supported by observed or derived opportunities, not generic selling language.
9. Use normalized public evidence when supplied. Evidence confidence reflects source strength, not certainty about unobserved facts.
10. You may identify supported functionality, conversion, booking, e-commerce, brand, content, or technical opportunities, but say "not evidenced" when the evidence does not establish a gap.

Return only valid JSON with exactly these keys:
businessSummary (string), opportunityLevel (very-low|low|medium|high|very-high), opportunityScore (integer 0-100), strengths (string[]), weaknesses (string[]), opportunities (string[]), risks (string[]), recommendedServices (string[]), evidence (array of {statement:string,type:fact|derived|inference,source:string,confidence?:integer 0-100}), reasoning (string), confidence (integer 0-100).

Keep lists concise. Do not include markdown fences or extra keys. Output must be valid JSON.`;
  
  console.log('\n--- Test with updated system prompt (includes "json") ---');
  await testDirect('groq', 'https://api.groq.com/openai/v1/chat/completions', groqKey, 'openai/gpt-oss-120b', {
    model: 'openai/gpt-oss-120b',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Analyze this lead using only the evidence below. Test lead analysis.' }
    ],
    max_tokens: 500,
    response_format: { type: "json_object" }
  });
  
  console.log('\n--- Test with "json" explicitly in user message ---');
  await testDirect('groq', 'https://api.groq.com/openai/v1/chat/completions', groqKey, 'openai/gpt-oss-120b', {
    model: 'openai/gpt-oss-120b',
    messages: [
      { role: 'system', content: 'You are an AI assistant. Output valid JSON.' },
      { role: 'user', content: 'Return a JSON object with the word "ok": {"status": "ok"}' }
    ],
    max_tokens: 50,
    response_format: { type: "json_object" }
  });
}

main().catch(console.error);