import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, webhook-signature",
};

const CLOUDFLARE_ACCOUNT_ID = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface StreamWebhookPayload {
  uid: string;
  readyToStream: boolean;
  status: {
    state: string;
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const payload: StreamWebhookPayload = await req.json();
    console.log("[CF-Webhook] Received:", JSON.stringify(payload));

    const { uid, readyToStream, status, meta, duration, size, input } = payload;

    if (!uid) {
      return new Response(JSON.stringify({ error: "Missing uid" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const statusState = status?.state || "unknown";
    const channelId = meta?.channel_id;

    // Generate playback URL
    const playbackUrl = readyToStream 
      ? `https://customer-${CLOUDFLARE_ACCOUNT_ID}.cloudflarestream.com/${uid}/manifest/video.m3u8`
      : null;

    // Update channel
    const updateData: any = {
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

    // Update upload record
    const uploadUpdateData: any = {
      status: readyToStream ? "ready" : statusState === "error" ? "error" : "processing",
      metadata: payload,
    };

    if (status?.errorReasonText) {
      uploadUpdateData.error_message = status.errorReasonText;
    }

    if (readyToStream) {
      uploadUpdateData.completed_at = new Date().toISOString();
    }

    await supabase
      .from("cf_stream_uploads")
      .update(uploadUpdateData)
      .eq("cf_stream_uid", uid);

    console.log(`[CF-Webhook] Updated ${uid} - Status: ${statusState}, Ready: ${readyToStream}`);

    return new Response(JSON.stringify({ 
      success: true,
      uid,
      status: statusState,
      readyToStream,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[CF-Webhook] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
