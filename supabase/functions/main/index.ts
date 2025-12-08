Deno.serve((req) => {
  const url = new URL(req.url);
  
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  // Health check
  if (url.pathname === '/' || url.pathname.includes('health')) {
    return new Response(JSON.stringify({ status: 'ok', time: new Date().toISOString() }), { headers });
  }

  return new Response(JSON.stringify({ path: url.pathname }), { headers });
});
