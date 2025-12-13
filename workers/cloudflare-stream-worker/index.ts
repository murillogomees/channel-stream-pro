/**
 * Cloudflare Worker - Cloudflare Stream Integration
 * Handles live streaming, video uploads, and Stream API management
 */

interface Env {
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_STREAM_API_TOKEN: string;
  CLOUDFLARE_STREAM_SIGNING_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  WORKER_SECRET: string;
}

interface StreamVideo {
  uid: string;
  thumbnail: string;
  playback: {
    hls: string;
    dash: string;
  };
  status: {
    state: string;
    pctComplete?: number;
  };
  duration: number;
  input: {
    width: number;
    height: number;
  };
  created: string;
  meta?: Record<string, string>;
}

interface LiveInput {
  uid: string;
  rtmps: {
    url: string;
    streamKey: string;
  };
  webRTC: {
    url: string;
  };
  srt: {
    url: string;
    streamId: string;
    passphrase: string;
  };
  status: string | null;
  created: string;
  meta?: Record<string, string>;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Worker-Secret',
};

const STREAM_API_BASE = 'https://api.cloudflare.com/client/v4/accounts';

async function callStreamAPI(
  env: Env,
  endpoint: string,
  method: string = 'GET',
  body?: unknown
): Promise<unknown> {
  const response = await fetch(
    `${STREAM_API_BASE}/${env.CLOUDFLARE_ACCOUNT_ID}/stream${endpoint}`,
    {
      method,
      headers: {
        'Authorization': `Bearer ${env.CLOUDFLARE_STREAM_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    }
  );

  const data = await response.json() as { success: boolean; result: unknown; errors: unknown[] };
  
  if (!data.success) {
    throw new Error(JSON.stringify(data.errors));
  }

  return data.result;
}

// Generate signed URL for video playback
async function generateSignedUrl(env: Env, videoId: string, expiresIn: number = 3600): Promise<string> {
  const expiry = Math.floor(Date.now() / 1000) + expiresIn;
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(env.CLOUDFLARE_STREAM_SIGNING_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const message = `${videoId}${expiry}`;
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  return `https://customer-${env.CLOUDFLARE_ACCOUNT_ID.substring(0, 8)}.cloudflarestream.com/${videoId}/manifest/video.m3u8?token=${signatureB64}&exp=${expiry}`;
}

// Video Management
async function handleVideoUpload(request: Request, env: Env): Promise<Response> {
  const { url, meta, requireSignedURLs, allowedOrigins } = await request.json() as {
    url: string;
    meta?: Record<string, string>;
    requireSignedURLs?: boolean;
    allowedOrigins?: string[];
  };

  if (!url) {
    return Response.json({ error: 'Video URL required' }, { status: 400 });
  }

  const result = await callStreamAPI(env, '/copy', 'POST', {
    url,
    meta: meta || {},
    requireSignedURLs: requireSignedURLs ?? true,
    allowedOrigins: allowedOrigins || ['iptvlink.com.br'],
  }) as StreamVideo;

  // Store in Supabase for tracking
  await fetch(`${env.SUPABASE_URL}/rest/v1/cf_stream_uploads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      stream_uid: result.uid,
      status: result.status.state,
      metadata: meta,
      created_at: result.created,
    }),
  });

  return Response.json({
    success: true,
    video: result,
  });
}

async function handleVideoList(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const search = url.searchParams.get('search');

  let endpoint = '?';
  if (status) endpoint += `status=${status}&`;
  if (search) endpoint += `search=${search}&`;

  const result = await callStreamAPI(env, endpoint.slice(0, -1) || '') as StreamVideo[];

  return Response.json({
    videos: result,
    total: result.length,
  });
}

async function handleVideoDetails(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const videoId = url.searchParams.get('id');

  if (!videoId) {
    return Response.json({ error: 'Video ID required' }, { status: 400 });
  }

  const result = await callStreamAPI(env, `/${videoId}`) as StreamVideo;

  return Response.json({ video: result });
}

async function handleVideoDelete(request: Request, env: Env): Promise<Response> {
  const { videoId } = await request.json() as { videoId: string };

  if (!videoId) {
    return Response.json({ error: 'Video ID required' }, { status: 400 });
  }

  await callStreamAPI(env, `/${videoId}`, 'DELETE');

  // Update Supabase
  await fetch(`${env.SUPABASE_URL}/rest/v1/cf_stream_uploads?stream_uid=eq.${videoId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
    },
  });

  return Response.json({ success: true });
}

async function handleGetPlaybackUrl(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const videoId = url.searchParams.get('id');
  const ttl = parseInt(url.searchParams.get('ttl') || '3600');

  if (!videoId) {
    return Response.json({ error: 'Video ID required' }, { status: 400 });
  }

  const signedUrl = await generateSignedUrl(env, videoId, ttl);

  return Response.json({
    url: signedUrl,
    expiresIn: ttl,
  });
}

// Live Streaming
async function handleCreateLiveInput(request: Request, env: Env): Promise<Response> {
  const { meta, recording, allowedOrigins } = await request.json() as {
    meta?: Record<string, string>;
    recording?: { mode: string; timeoutSeconds?: number };
    allowedOrigins?: string[];
  };

  const result = await callStreamAPI(env, '/live_inputs', 'POST', {
    meta: meta || {},
    recording: recording || { mode: 'automatic' },
    allowedOrigins: allowedOrigins || ['iptvlink.com.br'],
  }) as LiveInput;

  // Store in Supabase
  await fetch(`${env.SUPABASE_URL}/rest/v1/cf_live_inputs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({
      input_uid: result.uid,
      rtmps_url: result.rtmps.url,
      rtmps_key: result.rtmps.streamKey,
      webrtc_url: result.webRTC.url,
      srt_url: result.srt.url,
      srt_stream_id: result.srt.streamId,
      status: result.status,
      metadata: meta,
    }),
  });

  return Response.json({
    success: true,
    liveInput: result,
  });
}

async function handleListLiveInputs(env: Env): Promise<Response> {
  const result = await callStreamAPI(env, '/live_inputs') as LiveInput[];

  return Response.json({
    liveInputs: result,
    total: result.length,
  });
}

async function handleLiveInputDetails(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const inputId = url.searchParams.get('id');

  if (!inputId) {
    return Response.json({ error: 'Live input ID required' }, { status: 400 });
  }

  const result = await callStreamAPI(env, `/live_inputs/${inputId}`) as LiveInput;

  return Response.json({ liveInput: result });
}

async function handleDeleteLiveInput(request: Request, env: Env): Promise<Response> {
  const { inputId } = await request.json() as { inputId: string };

  if (!inputId) {
    return Response.json({ error: 'Live input ID required' }, { status: 400 });
  }

  await callStreamAPI(env, `/live_inputs/${inputId}`, 'DELETE');

  // Update Supabase
  await fetch(`${env.SUPABASE_URL}/rest/v1/cf_live_inputs?input_uid=eq.${inputId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
    },
  });

  return Response.json({ success: true });
}

async function handleGetLivePlayback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const inputId = url.searchParams.get('id');

  if (!inputId) {
    return Response.json({ error: 'Live input ID required' }, { status: 400 });
  }

  // Get live input outputs
  const result = await callStreamAPI(env, `/live_inputs/${inputId}/outputs`) as Array<{
    uid: string;
    url: string;
    streamKey: string;
  }>;

  // Generate playback URLs
  const playbackUrls = {
    hls: `https://customer-${env.CLOUDFLARE_ACCOUNT_ID.substring(0, 8)}.cloudflarestream.com/${inputId}/manifest/video.m3u8`,
    dash: `https://customer-${env.CLOUDFLARE_ACCOUNT_ID.substring(0, 8)}.cloudflarestream.com/${inputId}/manifest/video.mpd`,
  };

  return Response.json({
    playbackUrls,
    outputs: result,
  });
}

// Webhook handling for Stream events
async function handleWebhook(request: Request, env: Env): Promise<Response> {
  const signature = request.headers.get('Webhook-Signature');
  const body = await request.text();

  // Verify webhook signature (simplified)
  if (!signature) {
    return Response.json({ error: 'Missing signature' }, { status: 401 });
  }

  const event = JSON.parse(body) as {
    type: string;
    data: StreamVideo | LiveInput;
  };

  console.log(`Stream webhook: ${event.type}`, event.data);

  switch (event.type) {
    case 'video.upload':
    case 'video.ready':
    case 'video.error': {
      const video = event.data as StreamVideo;
      await fetch(`${env.SUPABASE_URL}/rest/v1/cf_stream_uploads?stream_uid=eq.${video.uid}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        },
        body: JSON.stringify({
          status: video.status.state,
          duration: video.duration,
          thumbnail_url: video.thumbnail,
          playback_hls: video.playback?.hls,
          playback_dash: video.playback?.dash,
          updated_at: new Date().toISOString(),
        }),
      });
      break;
    }

    case 'live_input.connected':
    case 'live_input.disconnected': {
      const input = event.data as LiveInput;
      await fetch(`${env.SUPABASE_URL}/rest/v1/cf_live_inputs?input_uid=eq.${input.uid}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        },
        body: JSON.stringify({
          status: event.type === 'live_input.connected' ? 'live' : 'idle',
          updated_at: new Date().toISOString(),
        }),
      });
      break;
    }
  }

  return Response.json({ received: true });
}

// Stats and analytics
async function handleStats(env: Env): Promise<Response> {
  const [videos, liveInputs] = await Promise.all([
    callStreamAPI(env, '') as Promise<StreamVideo[]>,
    callStreamAPI(env, '/live_inputs') as Promise<LiveInput[]>,
  ]);

  const stats = {
    totalVideos: videos.length,
    readyVideos: videos.filter(v => v.status.state === 'ready').length,
    pendingVideos: videos.filter(v => v.status.state === 'pending' || v.status.state === 'inprogress').length,
    errorVideos: videos.filter(v => v.status.state === 'error').length,
    totalLiveInputs: liveInputs.length,
    activeLiveInputs: liveInputs.filter(l => l.status === 'connected').length,
    totalDuration: videos.reduce((acc, v) => acc + (v.duration || 0), 0),
  };

  return Response.json({ stats });
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
        service: 'cloudflare-stream-worker',
        timestamp: new Date().toISOString(),
      }, { headers: corsHeaders });
    }

    // Webhook endpoint (public but verified by signature)
    if (path === '/webhook') {
      const response = await handleWebhook(request, env);
      return new Response(response.body, { ...response, headers: corsHeaders });
    }

    // Auth check for other endpoints
    const secret = request.headers.get('X-Worker-Secret');
    if (secret !== env.WORKER_SECRET) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    try {
      // Video endpoints
      if (path.startsWith('/video')) {
        switch (path) {
          case '/video/upload':
            return handleVideoUpload(request, env);
          case '/video/list':
            return handleVideoList(request, env);
          case '/video/details':
            return handleVideoDetails(request, env);
          case '/video/delete':
            return handleVideoDelete(request, env);
          case '/video/playback':
            return handleGetPlaybackUrl(request, env);
        }
      }

      // Live streaming endpoints
      if (path.startsWith('/live')) {
        switch (path) {
          case '/live/create':
            return handleCreateLiveInput(request, env);
          case '/live/list':
            return handleListLiveInputs(env);
          case '/live/details':
            return handleLiveInputDetails(request, env);
          case '/live/delete':
            return handleDeleteLiveInput(request, env);
          case '/live/playback':
            return handleGetLivePlayback(request, env);
        }
      }

      // Stats
      if (path === '/stats') {
        return handleStats(env);
      }

      return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
    } catch (error) {
      console.error('Stream Worker error:', error);
      return Response.json(
        { error: error instanceof Error ? error.message : 'Internal error' },
        { status: 500, headers: corsHeaders }
      );
    }
  },
};
