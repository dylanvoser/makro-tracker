exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { code } = JSON.parse(event.body);
    const correctCode = process.env.ACCESS_CODE;

    if (!correctCode) {
      // No code set = open access (fallback)
      return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
    }

    const isValid = code && code.trim() === correctCode.trim();
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: isValid })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok: false }) };
  }
};
