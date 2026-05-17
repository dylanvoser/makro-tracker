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

// Hilfsfunktion: API-Call mit gesamter Message-Historie
async function callClaude(apiKey, messages) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      // WICHTIG: Haiku unterstützt Web Search nicht zuverlässig.
      // Sonnet 4.5 oder neuer ist nötig. Falls Du Kosten sparen willst,
      // kannst Du nach dem Test auf 'claude-sonnet-4-5' bleiben.
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 3  // max 3 Suchen pro Anfrage = Kostenkontrolle
        }
      ],
      messages: messages
    })
  });
  return response.json();
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const apiKey = getApiKey();
  if (!apiKey) return { statusCode: 500, body: JSON.stringify({ error: 'Kein API-Key konfiguriert. Bitte in Netlify ENV eintragen.' }) };

  try {
    const { description } = JSON.parse(event.body);
    if (!description) return { statusCode: 400, body: JSON.stringify({ error: 'Beschreibung fehlt' }) };

    const userPrompt = `Analyze this meal/recipe and return ONLY a JSON object, no text before or after:
{"kalorien": number, "protein": number, "carbs": number, "fett": number, "sat_fat": number, "unsat_fat": number}

You may use web_search to look up nutrition data (e.g. brand-specific products, restaurant menus, or unfamiliar ingredients) if it helps accuracy. Prefer official manufacturer pages or established nutrition databases.

Rules:
- All values as integers
- fett = total fat grams
- sat_fat = saturated fat (from animal products, butter, coconut)
- unsat_fat = unsaturated fat (from plant oils, nuts, fish)
- sat_fat + unsat_fat must equal fett exactly
- If unsure about fat breakdown: sat_fat = round(fett * 0.4), unsat_fat = fett - sat_fat

After any search, output ONLY the JSON object as your final answer.

Meal: ${description}`;

    // Message-Historie aufbauen (für Tool-Use Loop)
    const messages = [{ role: 'user', content: userPrompt }];

    // Tool-Use Loop: max 5 Iterationen als Sicherheitsnetz
    let data;
    for (let i = 0; i < 5; i++) {
      data = await callClaude(apiKey, messages);

      if (data.error) {
        return { statusCode: 500, body: JSON.stringify({ error: data.error.message }) };
      }

      // Assistant-Antwort zur Historie hinzufügen
      messages.push({ role: 'assistant', content: data.content });

      // Wenn Claude fertig ist (kein weiterer Tool-Aufruf nötig) → raus aus dem Loop
      if (data.stop_reason !== 'tool_use') break;

      // Bei web_search ist KEIN tool_result vom Client nötig — das macht Anthropic serverseitig.
      // Aber falls Claude nach dem Such-Result noch nicht final geantwortet hat,
      // läuft der Loop weiter, bis stop_reason !== 'tool_use'.
      // In der Praxis kommt Web Search server-side zurück und Claude antwortet im selben Call.
      // Falls trotzdem ein weiterer Turn nötig ist, fahren wir fort.
    }

    // Finalen Text aus allen text-Blöcken extrahieren
    const text = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    // JSON extrahieren (auch wenn von Text umschlossen)
    const match = text.match(/\{[\s\S]*?\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      // sat_fat + unsat_fat = fett erzwingen
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
