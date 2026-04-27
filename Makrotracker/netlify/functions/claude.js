exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { description, apiKey } = JSON.parse(event.body);
    if (!apiKey || !description) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing apiKey or description' }) };
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `Analysiere diese Mahlzeit und gib NUR ein JSON-Objekt zurück (kein Text davor/danach):
{"kalorien": Zahl, "protein": Zahl, "carbs": Zahl, "fett": Zahl}
Alle Werte als ganze Zahlen.
Mahlzeit: ${description}`
        }]
      })
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const match = text.match(/\{[^}]+\}/);
    if (match) {
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: match[0]
      };
    }
    return { statusCode: 500, body: JSON.stringify({ error: 'KI Antwort ungültig', raw: text }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
