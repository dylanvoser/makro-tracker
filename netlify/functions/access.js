exports.handler = async (event) => {
  const headers = {'Content-Type':'application/json; charset=utf-8'};
  if (event.httpMethod !== 'POST') return {statusCode:405,headers,body:JSON.stringify({ok:false,error:'Method not allowed'})};
  try {
    const { code } = JSON.parse(event.body || '{}');
    const expected = process.env.ACCESS_CODE || '';
    if (!expected) return {statusCode:500,headers,body:JSON.stringify({ok:false,error:'ACCESS_CODE fehlt in Netlify ENV'})};
    return {statusCode:200,headers,body:JSON.stringify({ok:String(code||'') === expected})};
  } catch (e) {
    return {statusCode:400,headers,body:JSON.stringify({ok:false,error:'Ungültige Anfrage'})};
  }
};
