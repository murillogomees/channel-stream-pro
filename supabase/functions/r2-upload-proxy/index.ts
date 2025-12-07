import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// R2 Configuration
const R2_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID') || Deno.env.get('R2_ACCOUNT_ID');
const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID');
const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY');
const R2_BUCKET = Deno.env.get('R2_BUCKET_NAME') || 'iptvlink-cdn';

// AWS Signature V4 implementation for R2
async function hmac(key: ArrayBuffer, message: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
}

async function sha256Hash(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function getSignatureKey(
  key: string,
  dateStamp: string,
  region: string,
  service: string
): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const kDate = await hmac(encoder.encode('AWS4' + key), dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  return await hmac(kService, 'aws4_request');
}

async function signRequest(
  method: string,
  url: string,
  headers: Record<string, string>,
  body: Uint8Array | null,
  accessKeyId: string,
  secretAccessKey: string,
  region: string = 'auto',
  service: string = 's3'
): Promise<Record<string, string>> {
  const parsedUrl = new URL(url);
  const datetime = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const datestamp = datetime.substring(0, 8);
  
  // Calculate payload hash
  const payloadHash = body 
    ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', body)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
    : 'UNSIGNED-PAYLOAD';
  
  // Create canonical headers
  const signedHeadersList = ['host', 'x-amz-content-sha256', 'x-amz-date'];
  const canonicalHeaders = {
    'host': parsedUrl.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': datetime,
  };
  
  const sortedHeaders = Object.entries(canonicalHeaders)
    .sort(([a], [b]) => a.localeCompare(b));
  
  const canonicalHeadersStr = sortedHeaders
    .map(([k, v]) => `${k}:${v}`)
    .join('\n') + '\n';
  
  const signedHeaders = sortedHeaders.map(([k]) => k).join(';');
  
  // Create canonical request
  const canonicalUri = parsedUrl.pathname;
  const canonicalQueryString = parsedUrl.search.slice(1);
  
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeadersStr,
    signedHeaders,
    payloadHash,
  ].join('\n');
  
  // Create string to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${datestamp}/${region}/${service}/aws4_request`;
  const hashedCanonicalRequest = await sha256Hash(canonicalRequest);
  
  const stringToSign = [
    algorithm,
    datetime,
    credentialScope,
    hashedCanonicalRequest,
  ].join('\n');
  
  // Calculate signature
  const signingKey = await getSignatureKey(secretAccessKey, datestamp, region, service);
  const signatureBuffer = await hmac(signingKey, stringToSign);
  const signature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // Create authorization header
  const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  
  return {
    ...headers,
    'Authorization': authorizationHeader,
    'x-amz-date': datetime,
    'x-amz-content-sha256': payloadHash,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate R2 credentials
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      console.error('[R2Proxy] Missing R2 credentials:', {
        hasAccountId: !!R2_ACCOUNT_ID,
        hasAccessKey: !!R2_ACCESS_KEY_ID,
        hasSecretKey: !!R2_SECRET_ACCESS_KEY,
      });
      return new Response(
        JSON.stringify({ error: 'R2 credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { key, contentType, cacheControl, data, action } = body;

    if (!key) {
      return new Response(
        JSON.stringify({ error: 'Missing key parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const r2Endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    const objectUrl = `${r2Endpoint}/${R2_BUCKET}/${key}`;

    // HEAD request to check if object exists
    if (action === 'head') {
      console.log(`[R2Proxy] HEAD ${key}`);
      
      const signedHeaders = await signRequest(
        'HEAD',
        objectUrl,
        {},
        null,
        R2_ACCESS_KEY_ID,
        R2_SECRET_ACCESS_KEY
      );

      const response = await fetch(objectUrl, {
        method: 'HEAD',
        headers: signedHeaders,
      });

      if (response.status === 404) {
        return new Response(
          JSON.stringify({ exists: false }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!response.ok) {
        console.error(`[R2Proxy] HEAD failed: ${response.status} ${await response.text()}`);
        return new Response(
          JSON.stringify({ error: `HEAD failed: ${response.status}` }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          exists: true,
          etag: response.headers.get('etag') || '',
          size: parseInt(response.headers.get('content-length') || '0'),
          lastModified: response.headers.get('last-modified') || '',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PUT request to upload object
    if (!data) {
      return new Response(
        JSON.stringify({ error: 'Missing data parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[R2Proxy] Uploading ${key} (${data.length} bytes)`);

    const fileData = new Uint8Array(data);
    
    const putHeaders: Record<string, string> = {
      'Content-Type': contentType || 'application/octet-stream',
      'Content-Length': fileData.length.toString(),
    };
    
    if (cacheControl) {
      putHeaders['Cache-Control'] = cacheControl;
    }

    const signedHeaders = await signRequest(
      'PUT',
      objectUrl,
      putHeaders,
      fileData,
      R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY
    );

    const response = await fetch(objectUrl, {
      method: 'PUT',
      headers: signedHeaders,
      body: fileData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[R2Proxy] Upload failed: ${response.status}`, errorText);
      return new Response(
        JSON.stringify({ error: `Upload failed: ${response.status}`, details: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const etag = response.headers.get('etag') || '';
    console.log(`[R2Proxy] Upload successful: ${key}, etag: ${etag}`);

    return new Response(
      JSON.stringify({
        success: true,
        etag,
        size: fileData.length,
        url: `https://cdn.iptvlink.com.br/${key}`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[R2Proxy] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
