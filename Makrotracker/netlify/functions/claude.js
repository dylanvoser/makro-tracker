exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  try {
    const { description, apiKey } = JSON.parse(event.body);
    if (!apiKey || !description) return { statusCode: 400, body: JSON.stringify({ error: 'Missing fields' }) };
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: `Analyze this meal and return ONLY a JSON object, no text before or after:
{"kalorien": number, "protein": number, "carbs": number, "fett": number, "sat_fat": number, "unsat_fat": number}
All values as integers. Rules:
- fett = total fat
- sat_fat = saturated fatty acids (animal fats, butter, cheese, coconut oil etc)
- unsat_fat = unsaturated fatty acids (olive oil, nuts, avocado, fish etc)
- sat_fat + unsat_fat must equal fett exactly
Meal: ${description}` }]
      })
    });
    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const match = text.match(/\{[^}]+\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      // Ensure sat+unsat = fett
      if (parsed.sat_fat !== undefined && parsed.unsat_fat !== undefined) {
        const total = parsed.sat_fat + parsed.unsat_fat;
        if (total !== parsed.fett) {
          parsed.unsat_fat = Math.max(0, parsed.fett - parsed.sat_fat);
        }
      }
      return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }, body: JSON.stringify(parsed) };
    }
    return { statusCode: 500, body: JSON.stringify({ error: 'Invalid AI response', raw: text }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
