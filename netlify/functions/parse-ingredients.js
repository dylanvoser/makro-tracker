const Anthropic = require('@anthropic-ai/sdk');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { text } = body;
  if (!text || !text.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Text fehlt' }) };
  }

  const client = new Anthropic();

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Teile folgende Zutaten-Liste in strukturierte Einträge auf.
Antworte NUR mit einem JSON-Array, keine Erklärungen, keine Backticks, kein Markdown.
Jedes Element: {"amount": Zahl oder null, "unit": "g"|"ml"|"kg"|"l"|"portion"|"stueck"|"el"|"tl"|"tasse"|"pkg"|"stk", "name": "Zutatname"}
Einheiten immer auf diese erlaubten Werte normalisieren (z.B. "Gramm" → "g", "Milliliter" → "ml", "Stück" → "stueck", "Esslöffel" → "el").
Wenn keine Menge erkennbar, null für amount setzen. Wenn keine Einheit erkennbar, "stueck" verwenden.

Zutaten:
${text}`
      }
    ]
  });

  const raw = message.content?.[0]?.text || '[]';

  let parsed;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    // Try to extract JSON array from response
    const match = raw.match(/\[[\s\S]*\]/);
    try {
      parsed = match ? JSON.parse(match[0]) : [];
    } catch {
      parsed = [];
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: parsed })
  };
};
