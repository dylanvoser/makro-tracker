// Rotating API keys - set ANTHROPIC_KEY_1, ANTHROPIC_KEY_2, etc. in Netlify ENV
function getApiKey() {
  const keys = [];
  for (let i = 1; i <= 10; i++) {
    const k = process.env[`ANTHROPIC_KEY_${i}`];
    if (k) keys.push(k);
  }
  if (!keys.length) return null;
  // Rotate based on minute to distribute load
  const idx = Math.floor(Date.now() / 60000) % keys.length;
  return keys[idx];
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const apiKey = getApiKey();
  if (!apiKey) return { statusCode: 500, body: JSON.stringify({ error: 'Kein API-Key konfiguriert. Bitte in Netlify ENV eintragen.' }) };

  try {
    const { description } = JSON.parse(event.body);
    if (!description) return { statusCode: 400, body: JSON.stringify({ error: 'Beschreibung fehlt' }) };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: `Analyze this meal/recipe and return ONLY a JSON object, no text before or after:
{"kalorien": number, "protein": number, "carbs": number, "fett": number, "sat_fat": number, "unsat_fat": number}
Rules:
- All values as integers
- fett = total fat grams
- sat_fat = saturated fat (from animal products, butter, coconut)
- unsat_fat = unsaturated fat (from plant oils, nuts, fish)
- sat_fat + unsat_fat must equal fett exactly
- If unsure about fat breakdown: sat_fat = round(fett * 0.4), unsat_fat = fett - sat_fat
Meal: ${description}` }]
      })
    });

    const data = await response.json();
    if (data.error) return { statusCode: 500, body: JSON.stringify({ error: data.error.message }) };

    const text = data.content?.[0]?.text || '';
    const match = text.match(/\{[^}]+\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      // Enforce sat_fat + unsat_fat = fett
      if (parsed.sat_fat !== undefined && parsed.fett !== undefined) {
        parsed.unsat_fat = Math.max(0, parsed.fett - parsed.sat_fat);
      }
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed)
      };
    }
    return { statusCode: 500, body: JSON.stringify({ error: 'Ungueltige KI-Antwort', raw: text }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
