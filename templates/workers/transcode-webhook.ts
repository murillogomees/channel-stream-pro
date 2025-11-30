/**
 * Transcode Webhook Consumer Template
 * 
 * Receives webhooks from transcoding service (FFmpeg/Cloudflare Stream)
 * and updates database with results
 * 
 * Environment Variables Required:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - WEBHOOK_SECRET (for signature verification)
 * - SLACK_WEBHOOK_URL (optional, for notifications)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Types
interface TranscodeWebhook {
  type: 'upload.complete' | 'upload.failed' | 'stream.ready' | 'stream.error';
  timestamp: string;
  data: {
    uid: string;
    channel_id?: string;
    status: string;
    duration?: number;
    size?: number;
    playback_url?: string;
    thumbnail_url?: string;
    error?: string;
    metadata?: Record<string, unknown>;
  };
}

interface CloudflareStreamWebhook {
  uid: string;
  readyToStream: boolean;
  status: {
    state: string;
    pctComplete?: string;
    errorReasonCode?: string;
    errorReasonText?: string;
  };
  meta?: {
    channel_id?: string;
    name?: string;
  };
  duration?: number;
  size?: number;
  playback?: {
    hls?: string;
    dash?: string;
  };
  thumbnail?: string;
  created?: string;
  modified?: string;
}

// Verify webhook signature
async function verifySignature(
  body: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature) return false;

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureBytes = hexToBytes(signature);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      new TextEncoder().encode(body)
    );

    return valid;
  } catch {
    return false;
  }
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

// Process Cloudflare Stream webhook
async function processCloudflareWebhook(
  webhook: CloudflareStreamWebhook,
  supabase: SupabaseClient
): Promise<{ success: boolean; message: string }> {
  const channelId = webhook.meta?.channel_id;

  if (!channelId) {
    console.warn('[Transcode] No channel_id in webhook metadata');
    return { success: false, message: 'Missing channel_id' };
  }

  console.log(`[Transcode] Processing CF Stream webhook: ${webhook.uid}, state: ${webhook.status.state}`);

  // Update cf_stream_uploads table
  const uploadUpdate: Record<string, unknown> = {
    cf_stream_uid: webhook.uid,
    status: webhook.status.state,
    updated_at: new Date().toISOString(),
  };

  if (webhook.status.pctComplete) {
    uploadUpdate.progress_percent = parseInt(webhook.status.pctComplete, 10);
  }

  if (webhook.status.errorReasonText) {
    uploadUpdate.error_message = webhook.status.errorReasonText;
  }

  if (webhook.readyToStream) {
    uploadUpdate.status = 'completed';
    uploadUpdate.completed_at = new Date().toISOString();
  }

  await supabase
    .from('cf_stream_uploads')
    .update(uploadUpdate)
    .eq('channel_id', channelId);

  // Update channel with stream info if ready
  if (webhook.readyToStream) {
    const channelUpdate: Record<string, unknown> = {
      cf_stream_uid: webhook.uid,
      cf_stream_status: 'ready',
      cf_stream_uploaded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (webhook.playback?.hls) {
      channelUpdate.cf_stream_url = webhook.playback.hls;
    }

    if (webhook.duration) {
      channelUpdate.cf_stream_duration_seconds = webhook.duration;
    }

    if (webhook.size) {
      channelUpdate.cf_stream_size_bytes = webhook.size;
    }

    await supabase
      .from('m3u_channels')
      .update(channelUpdate)
      .eq('id', channelId);

    console.log(`[Transcode] Channel ${channelId} ready for streaming`);
  }

  // Handle errors
  if (webhook.status.errorReasonCode) {
    await supabase
      .from('m3u_channels')
      .update({
        cf_stream_status: 'error',
        updated_at: new Date().toISOString(),
      })
      .eq('id', channelId);

    console.error(`[Transcode] Channel ${channelId} failed: ${webhook.status.errorReasonText}`);
  }

  return { 
    success: true, 
    message: `Processed webhook for channel ${channelId}` 
  };
}

// Process generic transcode webhook
async function processGenericWebhook(
  webhook: TranscodeWebhook,
  supabase: SupabaseClient
): Promise<{ success: boolean; message: string }> {
  const { type, data } = webhook;
  const channelId = data.channel_id;

  if (!channelId) {
    return { success: false, message: 'Missing channel_id' };
  }

  console.log(`[Transcode] Processing webhook type: ${type} for channel: ${channelId}`);

  switch (type) {
    case 'upload.complete':
    case 'stream.ready': {
      await supabase
        .from('m3u_channels')
        .update({
          cf_stream_uid: data.uid,
          cf_stream_status: 'ready',
          cf_stream_url: data.playback_url,
          cf_stream_duration_seconds: data.duration,
          cf_stream_size_bytes: data.size,
          cf_stream_uploaded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', channelId);

      await supabase
        .from('cf_stream_uploads')
        .update({
          status: 'completed',
          cf_stream_uid: data.uid,
          completed_at: new Date().toISOString(),
        })
        .eq('channel_id', channelId);

      return { success: true, message: 'Stream ready' };
    }

    case 'upload.failed':
    case 'stream.error': {
      await supabase
        .from('m3u_channels')
        .update({
          cf_stream_status: 'error',
          updated_at: new Date().toISOString(),
        })
        .eq('id', channelId);

      await supabase
        .from('cf_stream_uploads')
        .update({
          status: 'failed',
          error_message: data.error,
          completed_at: new Date().toISOString(),
        })
        .eq('channel_id', channelId);

      return { success: true, message: `Stream failed: ${data.error}` };
    }

    default:
      return { success: false, message: `Unknown webhook type: ${type}` };
  }
}

// Send Slack notification
async function sendSlackNotification(
  webhookUrl: string,
  message: string,
  isError: boolean = false
): Promise<void> {
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `${isError ? '🚨' : '✅'} [Transcode] ${message}`,
      }),
    });
  } catch (error) {
    console.error('[Transcode] Failed to send Slack notification:', error);
  }
}

// Main handler
export default {
  async fetch(request: Request, env: Record<string, string>): Promise<Response> {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, X-Webhook-Signature, CF-Webhook-Auth',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    try {
      const body = await request.text();

      // Verify signature if configured
      if (env.WEBHOOK_SECRET) {
        const signature = request.headers.get('X-Webhook-Signature') 
          || request.headers.get('CF-Webhook-Auth');
        
        const valid = await verifySignature(body, signature, env.WEBHOOK_SECRET);
        if (!valid) {
          console.warn('[Transcode] Invalid webhook signature');
          return new Response('Invalid signature', { status: 401, headers: corsHeaders });
        }
      }

      const webhook = JSON.parse(body);
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

      let result: { success: boolean; message: string };

      // Detect webhook format
      if (webhook.uid && webhook.status?.state) {
        // Cloudflare Stream webhook
        result = await processCloudflareWebhook(webhook, supabase);
      } else if (webhook.type && webhook.data) {
        // Generic webhook format
        result = await processGenericWebhook(webhook, supabase);
      } else {
        return new Response('Unknown webhook format', { status: 400, headers: corsHeaders });
      }

      // Send notification for important events
      if (env.SLACK_WEBHOOK_URL) {
        if (webhook.readyToStream || webhook.type === 'stream.ready') {
          await sendSlackNotification(env.SLACK_WEBHOOK_URL, result.message, false);
        } else if (webhook.status?.errorReasonCode || webhook.type?.includes('failed')) {
          await sendSlackNotification(env.SLACK_WEBHOOK_URL, result.message, true);
        }
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: result.success ? 200 : 400,
      });
    } catch (error) {
      console.error('[Transcode] Webhook processing error:', error);
      return new Response(JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
