/**
 * Cloudflare Worker - VOD Download Manager
 * Handles video-on-demand downloads with chunked transfer and resume support
 */

interface Env {
  R2_BUCKET: R2Bucket;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  WORKER_SECRET: string;
  JWT_SECRET: string;
  CDN_BASE_URL: string;
}

interface DownloadToken {
  userId: string;
  contentId: string;
  exp: number;
  iat: number;
}

interface VODContent {
  id: string;
  title: string;
  file_path: string;
  file_size: number;
  content_type: string;
  duration: number;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range, X-Worker-Secret',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, X-Download-Id',
};

// Simple JWT verification
async function verifyJWT(token: string, secret: string): Promise<DownloadToken | null> {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split('.');
    if (!headerB64 || !payloadB64 || !signatureB64) return null;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureInput = `${headerB64}.${payloadB64}`;
    const signature = Uint8Array.from(atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      encoder.encode(signatureInput)
    );

    if (!isValid) return null;

    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
    
    // Check expiration
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return null;
    }

    return payload as DownloadToken;
  } catch {
    return null;
  }
}

async function generateDownloadToken(
  env: Env,
  userId: string,
  contentId: string,
  ttlSeconds: number = 3600
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload: DownloadToken = {
    userId,
    contentId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(env.JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureInput = `${headerB64}.${payloadB64}`;
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signatureInput));
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

function parseRange(rangeHeader: string | null, fileSize: number): { start: number; end: number } | null {
  if (!rangeHeader) return null;

  const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
  if (!match) return null;

  const start = match[1] ? parseInt(match[1], 10) : 0;
  const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

  if (start > end || start >= fileSize) return null;

  return { start, end: Math.min(end, fileSize - 1) };
}

async function getContentMetadata(env: Env, contentId: string): Promise<VODContent | null> {
  // Try to get from R2 metadata first
  const metaObject = await env.R2_BUCKET.get(`vod/${contentId}/metadata.json`);
  if (metaObject) {
    return await metaObject.json();
  }

  // Fallback to Supabase
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/vod_content?id=eq.${contentId}`,
    {
      headers: {
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      },
    }
  );

  const contents = await response.json() as VODContent[];
  return contents[0] || null;
}

async function handleDownload(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const contentId = url.searchParams.get('id');
  const token = url.searchParams.get('token') || request.headers.get('Authorization')?.replace('Bearer ', '');

  if (!contentId) {
    return Response.json({ error: 'Content ID required' }, { status: 400, headers: corsHeaders });
  }

  if (!token) {
    return Response.json({ error: 'Download token required' }, { status: 401, headers: corsHeaders });
  }

  // Verify token
  const tokenData = await verifyJWT(token, env.JWT_SECRET);
  if (!tokenData || tokenData.contentId !== contentId) {
    return Response.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders });
  }

  // Get content metadata
  const content = await getContentMetadata(env, contentId);
  if (!content) {
    return Response.json({ error: 'Content not found' }, { status: 404, headers: corsHeaders });
  }

  // Get file from R2
  const filePath = content.file_path || `vod/${contentId}/video.mp4`;
  const object = await env.R2_BUCKET.get(filePath);

  if (!object) {
    return Response.json({ error: 'File not found' }, { status: 404, headers: corsHeaders });
  }

  const fileSize = object.size;
  const range = parseRange(request.headers.get('Range'), fileSize);

  const headers: Record<string, string> = {
    ...corsHeaders,
    'Content-Type': content.content_type || 'video/mp4',
    'Accept-Ranges': 'bytes',
    'X-Download-Id': contentId,
    'Cache-Control': 'private, max-age=3600',
  };

  // Handle range request
  if (range) {
    const { start, end } = range;
    const contentLength = end - start + 1;

    headers['Content-Range'] = `bytes ${start}-${end}/${fileSize}`;
    headers['Content-Length'] = String(contentLength);

    // Get range from R2
    const rangeObject = await env.R2_BUCKET.get(filePath, {
      range: { offset: start, length: contentLength },
    });

    if (!rangeObject) {
      return Response.json({ error: 'Range not satisfiable' }, { status: 416, headers: corsHeaders });
    }

    return new Response(rangeObject.body, {
      status: 206,
      headers,
    });
  }

  // Full file download
  headers['Content-Length'] = String(fileSize);
  headers['Content-Disposition'] = `attachment; filename="${content.title || contentId}.mp4"`;

  return new Response(object.body, {
    status: 200,
    headers,
  });
}

async function handleGenerateToken(request: Request, env: Env): Promise<Response> {
  const { userId, contentId, ttl } = await request.json() as {
    userId: string;
    contentId: string;
    ttl?: number;
  };

  if (!userId || !contentId) {
    return Response.json({ error: 'userId and contentId required' }, { status: 400 });
  }

  // Verify user has access to content (check subscription)
  const subscriptionCheck = await fetch(
    `${env.SUPABASE_URL}/rest/v1/user_subscriptions?user_id=eq.${userId}&status=eq.active`,
    {
      headers: {
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      },
    }
  );

  const subscriptions = await subscriptionCheck.json() as Array<{ id: string }>;
  if (!subscriptions.length) {
    return Response.json({ error: 'No active subscription' }, { status: 403 });
  }

  const token = await generateDownloadToken(env, userId, contentId, ttl || 3600);
  const downloadUrl = `${env.CDN_BASE_URL || 'https://vod-worker.your-domain.workers.dev'}/download?id=${contentId}&token=${token}`;

  return Response.json({
    success: true,
    token,
    downloadUrl,
    expiresIn: ttl || 3600,
  });
}

async function handleUpload(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const contentId = url.searchParams.get('id') || crypto.randomUUID();
  const contentType = request.headers.get('Content-Type') || 'video/mp4';

  const filePath = `vod/${contentId}/video.mp4`;

  // Upload to R2
  await env.R2_BUCKET.put(filePath, request.body, {
    httpMetadata: { contentType },
  });

  // Store metadata
  const metadata: VODContent = {
    id: contentId,
    title: url.searchParams.get('title') || contentId,
    file_path: filePath,
    file_size: parseInt(request.headers.get('Content-Length') || '0'),
    content_type: contentType,
    duration: 0,
  };

  await env.R2_BUCKET.put(`vod/${contentId}/metadata.json`, JSON.stringify(metadata), {
    httpMetadata: { contentType: 'application/json' },
  });

  return Response.json({
    success: true,
    contentId,
    filePath,
  });
}

async function handleList(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const prefix = url.searchParams.get('prefix') || 'vod/';
  const limit = parseInt(url.searchParams.get('limit') || '50');

  const listed = await env.R2_BUCKET.list({ prefix, limit });

  const contents = listed.objects
    .filter(obj => obj.key.endsWith('metadata.json'))
    .map(obj => ({
      key: obj.key.replace('/metadata.json', '').replace('vod/', ''),
      size: obj.size,
      uploaded: obj.uploaded,
    }));

  return Response.json({
    contents,
    total: contents.length,
    truncated: listed.truncated,
  });
}

async function handleDelete(request: Request, env: Env): Promise<Response> {
  const { contentId } = await request.json() as { contentId: string };

  if (!contentId) {
    return Response.json({ error: 'contentId required' }, { status: 400 });
  }

  // Delete all files for this content
  const listed = await env.R2_BUCKET.list({ prefix: `vod/${contentId}/` });

  for (const obj of listed.objects) {
    await env.R2_BUCKET.delete(obj.key);
  }

  return Response.json({
    success: true,
    deleted: listed.objects.length,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Health check
    if (path === '/health') {
      return Response.json({
        status: 'healthy',
        service: 'vod-download-worker',
        timestamp: new Date().toISOString(),
      }, { headers: corsHeaders });
    }

    // Download endpoint (public with token)
    if (path === '/download') {
      return handleDownload(request, env);
    }

    // Auth required for management endpoints
    const secret = request.headers.get('X-Worker-Secret');
    if (secret !== env.WORKER_SECRET) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    try {
      switch (path) {
        case '/generate-token':
          return handleGenerateToken(request, env);
        case '/upload':
          return handleUpload(request, env);
        case '/list':
          return handleList(request, env);
        case '/delete':
          return handleDelete(request, env);
        default:
          return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
      }
    } catch (error) {
      console.error('VOD Worker error:', error);
      return Response.json(
        { error: error instanceof Error ? error.message : 'Internal error' },
        { status: 500, headers: corsHeaders }
      );
    }
  },
};
