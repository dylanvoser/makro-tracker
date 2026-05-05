// Same key rotation as claude.js
function getApiKey() {
  const keys = [];
  for (let i = 1; i <= 10; i++) {
    const k = process.env[`ANTHROPIC_KEY_${i}`];
    if (k) keys.push(k);
  }
  if (!keys.length) return null;
  const idx = Math.floor(Date.now() / 60000) % keys.length;
  return keys[idx];
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const apiKey = getApiKey();
  if (!apiKey) return { statusCode: 500, body: JSON.stringify({ error: 'Kein API-Key konfiguriert.' }) };

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { text } = body;
  if (!text || !text.trim()) return { statusCode: 400, body: JSON.stringify({ error: 'Text fehlt' }) };

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: `Parse the following ingredient list into a JSON array. Return ONLY the JSON array, no text, no markdown, no backticks.
Each element: {"amount": number or null, "unit": "g"|"ml"|"kg"|"l"|"portion"|"stueck"|"el"|"tl"|"tasse"|"pkg", "name": "ingredient name"}
Rules:
- Normalize units: Gramm/gr→g, Milliliter→ml, Stück/stk/x→stueck, Esslöffel/EL→el, Teelöffel/TL→tl, Packung/Pkg→pkg
- If no amount: null
- If no unit recognizable: stueck
- Name should be clean (no quantity/unit in name)
Ingredients:
${text}` }]
      })
    });

    const data = await response.json();
    if (data.error) return { statusCode: 500, body: JSON.stringify({ error: data.error.message }) };

    const raw = data.content?.[0]?.text || '[]';
    let parsed;
    try {
      parsed = JSON.parse(raw.trim());
    } catch {
      const match = raw.match(/\[[\s\S]*\]/);
      try { parsed = match ? JSON.parse(match[0]) : []; } catch { parsed = []; }
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: parsed })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
