const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';
function getKey() {
  const keys = [];
  for (let i = 1; i <= 10; i++) if (process.env[`ANTHROPIC_KEY_${i}`]) keys.push(process.env[`ANTHROPIC_KEY_${i}`]);
  if (process.env.ANTHROPIC_API_KEY) keys.push(process.env.ANTHROPIC_API_KEY);
  if (!keys.length) return null;
  const idx = Math.floor(Date.now() / 60000) % keys.length;
  return keys[idx];
}
function cleanJson(text){
  const m = String(text || '').match(/\{[\s\S]*\}/);
  return m ? m[0] : text;
}
exports.handler = async (event) => {
  const headers = {'Content-Type':'application/json; charset=utf-8'};
  if (event.httpMethod !== 'POST') return {statusCode:405,headers,body:JSON.stringify({error:'Method not allowed'})};
  const key = getKey();
  if (!key) return {statusCode:500,headers,body:JSON.stringify({error:'Kein Anthropic API-Key in Netlify ENV gefunden'})};
  try {
    const body = JSON.parse(event.body || '{}');
    const mode = body.mode || 'meal';
    const amountText = body.amount && body.unit ? `Die folgenden Makros sollen für die komplette Rezept-Basismenge ${body.amount} ${body.unit} gelten.` : '';
    const prompt = mode === 'recipe'
      ? `Analysiere dieses Rezept auf Deutsch. ${amountText}\nName: ${body.name || ''}\nZutaten: ${body.text || ''}\nWichtig: Gib die Werte für die gesamte angegebene Basismenge aus, nicht pro 100g und nicht pro Portion, ausser die Basismenge ist Portion. Antworte ausschliesslich als JSON mit den Feldern kalorien, protein, carbs, fett, sat_fat, unsat_fat, hinweis. Zahlen ohne Einheiten. sat_fat + unsat_fat muss ungefähr fett ergeben. Wenn unbekannt, realistisch schätzen.`
      : `Analysiere diese Mahlzeit auf Deutsch: ${body.text || ''}\nAntworte ausschliesslich als JSON mit den Feldern kalorien, protein, carbs, fett, sat_fat, unsat_fat, hinweis. Zahlen ohne Einheiten. sat_fat + unsat_fat muss ungefähr fett ergeben. Keine Zutaten hinzufügen, die nicht genannt sind.`;
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},
      body: JSON.stringify({model: MODEL, max_tokens: 600, temperature: 0.1, messages:[{role:'user',content:prompt}]})
    });
    const data = await res.json();
    if (!res.ok) return {statusCode:res.status,headers,body:JSON.stringify({error:data.error?.message || 'Claude API Fehler'})};
    const txt = data.content?.[0]?.text || '{}';
    let parsed = JSON.parse(cleanJson(txt));
    const n = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
    parsed = {
      kalorien: Math.round(n(parsed.kalorien)),
      protein: +n(parsed.protein).toFixed(1),
      carbs: +n(parsed.carbs).toFixed(1),
      fett: +n(parsed.fett).toFixed(1),
      sat_fat: +n(parsed.sat_fat).toFixed(1),
      unsat_fat: +n(parsed.unsat_fat).toFixed(1),
      hinweis: parsed.hinweis || ''
    };
    if (parsed.fett && Math.abs((parsed.sat_fat + parsed.unsat_fat) - parsed.fett) > 1.5) {
      const ratio = parsed.sat_fat / Math.max(parsed.sat_fat + parsed.unsat_fat, 1);
      parsed.sat_fat = +(parsed.fett * ratio).toFixed(1);
      parsed.unsat_fat = +(parsed.fett - parsed.sat_fat).toFixed(1);
    }
    return {statusCode:200,headers,body:JSON.stringify(parsed)};
  } catch (e) {
    return {statusCode:500,headers,body:JSON.stringify({error:e.message || 'Analyse fehlgeschlagen'})};
  }
};
