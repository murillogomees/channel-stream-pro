const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const results: any[] = []
  const baseUrl = 'https://blaze.officeb.site'
  
  // Test URLs
  const testUrls = [
    { url: `${baseUrl}/`, method: 'GET', label: 'Root' },
    { url: `${baseUrl}/api`, method: 'GET', label: 'API root' },
    { url: `${baseUrl}/api/auth/me`, method: 'GET', label: 'Auth me' },
    { url: `${baseUrl}/api/auth/login`, method: 'POST', label: 'Auth login', body: JSON.stringify({ email: 'murilloggomes@gmail.com', password: '@LPko2930@' }) },
    { url: `${baseUrl}/api/login`, method: 'POST', label: 'API login', body: JSON.stringify({ email: 'murilloggomes@gmail.com', password: '@LPko2930@' }) },
    { url: `${baseUrl}/api/auth/signin`, method: 'POST', label: 'Auth signin', body: JSON.stringify({ email: 'murilloggomes@gmail.com', password: '@LPko2930@' }) },
    { url: `${baseUrl}/api/sessions`, method: 'POST', label: 'Sessions', body: JSON.stringify({ email: 'murilloggomes@gmail.com', password: '@LPko2930@' }) },
  ]

  for (const test of testUrls) {
    try {
      const opts: RequestInit = {
        method: test.method,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Content-Type': 'application/json',
          'Origin': 'https://blaze.officeb.site',
          'Referer': 'https://blaze.officeb.site/',
        },
      }
      if (test.body) opts.body = test.body

      const response = await fetch(test.url, opts)
      const text = await response.text()
      const cookies = response.headers.get('set-cookie')
      
      results.push({
        label: test.label,
        url: test.url,
        status: response.status,
        statusText: response.statusText,
        body: text.substring(0, 500),
        cookies: cookies || null,
        contentType: response.headers.get('content-type'),
      })
    } catch (e) {
      results.push({
        label: test.label,
        url: test.url,
        error: (e as Error).message,
      })
    }
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
