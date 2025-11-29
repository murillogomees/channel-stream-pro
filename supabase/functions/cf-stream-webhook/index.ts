import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, webhook-signature, cf-webhook-auth",
};

const CLOUDFLARE_ACCOUNT_ID = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface StreamWebhookPayload {
  uid?: string;
  readyToStream?: boolean;
  status?: {
    state?: string;
    pctComplete?: string;
    errorReasonCode?: string;
    errorReasonText?: string;
  };
  meta?: {
    name?: string;
    channel_id?: string;
  };
  duration?: number;
  size?: number;
  created?: string;
  modified?: string;
  input?: {
    width?: number;
    height?: number;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle GET requests (verification/health check)
  if (req.method === "GET") {
    console.log("[CF-Webhook] GET request received - verification/health check");
    return new Response(JSON.stringify({ 
      status: "ok", 
      message: "Cloudflare Stream webhook endpoint ready",
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Try to parse the body, but handle empty/invalid bodies gracefully
    let payload: StreamWebhookPayload = {};
    
    try {
      const bodyText = await req.text();
      console.log("[CF-Webhook] Raw body:", bodyText);
      
      if (bodyText && bodyText.trim()) {
        payload = JSON.parse(bodyText);
      }
    } catch (parseError) {
      console.log("[CF-Webhook] Body parse error (might be test request):", parseError);
    }

    console.log("[CF-Webhook] Parsed payload:", JSON.stringify(payload));

    // If no uid, this is likely a test/verification request - return success
    if (!payload.uid) {
      console.log("[CF-Webhook] No uid in payload - treating as test/verification request");
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Webhook verification successful",
        received: payload,
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Real webhook payload processing
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { uid, readyToStream, status, meta, duration, size } = payload;
    const statusState = status?.state || "unknown";
    const channelId = meta?.channel_id;
    
    // Extract progress percentage from pctComplete
    const progressPercent = status?.pctComplete 
      ? parseFloat(status.pctComplete) 
      : (readyToStream ? 100 : 0);

    console.log(`[CF-Webhook] Processing ${uid} - State: ${statusState}, Progress: ${progressPercent}%`);

    // Generate playback URL
    const playbackUrl = readyToStream 
      ? `https://customer-${CLOUDFLARE_ACCOUNT_ID}.cloudflarestream.com/${uid}/manifest/video.m3u8`
      : null;

    // Update channel
    const updateData: Record<string, unknown> = {
      cf_stream_status: statusState,
    };

    if (readyToStream && playbackUrl) {
      updateData.cf_stream_url = playbackUrl;
    }

    if (duration) {
      updateData.cf_stream_duration_seconds = Math.floor(duration);
    }

    if (size) {
      updateData.cf_stream_size_bytes = size;
    }

    // Update by cf_stream_uid or channel_id
    let updateQuery = supabase.from("m3u_channels").update(updateData);
    
    if (channelId) {
      updateQuery = updateQuery.eq("id", channelId);
    } else {
      updateQuery = updateQuery.eq("cf_stream_uid", uid);
    }

    const { error: channelError } = await updateQuery;

    if (channelError) {
      console.error("[CF-Webhook] Failed to update channel:", channelError);
    }

    // Update upload record with progress percentage
    const uploadUpdateData: Record<string, unknown> = {
      status: readyToStream ? "ready" : statusState === "error" ? "error" : "processing",
      progress_percent: progressPercent,
      metadata: payload,
      updated_at: new Date().toISOString(),
    };

    if (status?.errorReasonText) {
      uploadUpdateData.error_message = status.errorReasonText;
    }

    if (readyToStream) {
      uploadUpdateData.completed_at = new Date().toISOString();
      uploadUpdateData.progress_percent = 100;
    }

    const { error: uploadError } = await supabase
      .from("cf_stream_uploads")
      .update(uploadUpdateData)
      .eq("cf_stream_uid", uid);

    if (uploadError) {
      console.error("[CF-Webhook] Failed to update upload record:", uploadError);
    }

    console.log(`[CF-Webhook] Updated ${uid} - Status: ${statusState}, Progress: ${progressPercent}%, Ready: ${readyToStream}`);

    return new Response(JSON.stringify({ 
      success: true,
      uid,
      status: statusState,
      progress: progressPercent,
      readyToStream,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[CF-Webhook] Error:", error);
    // Return 200 even on error to prevent Cloudflare from marking webhook as failed
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      message: "Error processing webhook, but endpoint is reachable"
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
