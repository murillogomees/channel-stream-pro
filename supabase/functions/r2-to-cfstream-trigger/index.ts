import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLOUDFLARE_ACCOUNT_ID = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
const CLOUDFLARE_STREAM_API_TOKEN = Deno.env.get("CLOUDFLARE_STREAM_API_TOKEN");

interface TriggerRequest {
  channel_id: string;
  r2_url: string;
  r2_key: string;
  file_size_bytes?: number;
  force?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Auth verification
    const internalSecret = req.headers.get("x-internal-secret");
    const expectedSecret = Deno.env.get("CRON_SECRET");
    const authHeader = req.headers.get("authorization");

    const isInternalCall = internalSecret === expectedSecret;
    
    if (!isInternalCall && authHeader) {
      const supabaseAuth = createClient(
        SUPABASE_URL,
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: isAdmin } = await supabaseAuth.rpc("is_admin_or_master", { _user_id: user.id });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Admin required" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (!isInternalCall) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if auto-transcode is enabled
    const { data: config } = await supabase
      .from("storage_config")
      .select("config_value")
      .eq("config_key", "auto_transcode_enabled")
      .single();

    const autoEnabled = config?.config_value?.enabled ?? true;

    const body: TriggerRequest = await req.json();
    const { channel_id, r2_url, r2_key, file_size_bytes, force } = body;

    if (!channel_id || !r2_url) {
      return new Response(JSON.stringify({ error: "channel_id and r2_url required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if auto-transcode is disabled and not forced
    if (!autoEnabled && !force) {
      console.log(`[R2→CF] Auto-transcode disabled, skipping ${channel_id}`);
      return new Response(JSON.stringify({ 
        skipped: true, 
        reason: "auto_transcode_disabled" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if already has CF Stream upload
    const { data: existingUpload } = await supabase
      .from("cf_stream_uploads")
      .select("id, status")
      .eq("channel_id", channel_id)
      .in("status", ["queued", "downloading", "processing", "ready"])
      .maybeSingle();

    if (existingUpload && !force) {
      console.log(`[R2→CF] Already has CF Stream upload: ${channel_id} (${existingUpload.status})`);
      return new Response(JSON.stringify({ 
        skipped: true, 
        reason: "already_exists",
        existing_status: existingUpload.status 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create sync event
    const { data: syncEvent, error: syncError } = await supabase
      .from("storage_sync_events")
      .insert({
        source_type: "r2",
        target_type: "cfstream",
        channel_id,
        source_url: r2_url,
        status: "pending",
        file_size_bytes,
        metadata: { r2_key, triggered_at: new Date().toISOString() }
      })
      .select()
      .single();

    if (syncError) {
      console.error("[R2→CF] Failed to create sync event:", syncError);
      throw syncError;
    }

    console.log(`[R2→CF] Created sync event ${syncEvent.id} for channel ${channel_id}`);

    // Get channel info
    const { data: channel } = await supabase
      .from("m3u_channels")
      .select("name, stream_url")
      .eq("id", channel_id)
      .single();

    if (!channel) {
      await supabase.from("storage_sync_events").update({
        status: "failed",
        error_message: "Channel not found"
      }).eq("id", syncEvent.id);
      
      return new Response(JSON.stringify({ error: "Channel not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update sync event to syncing
    await supabase.from("storage_sync_events").update({
      status: "syncing",
      started_at: new Date().toISOString()
    }).eq("id", syncEvent.id);

    // Create CF Stream upload record
    const { data: cfUpload, error: cfError } = await supabase
      .from("cf_stream_uploads")
      .insert({
        channel_id,
        original_url: r2_url,
        status: "queued",
        upload_type: "url_pull",
        metadata: { 
          source: "r2_auto_sync",
          sync_event_id: syncEvent.id,
          channel_name: channel.name
        }
      })
      .select()
      .single();

    if (cfError) {
      await supabase.from("storage_sync_events").update({
        status: "failed",
        error_message: cfError.message
      }).eq("id", syncEvent.id);
      throw cfError;
    }

    // Trigger CF Stream upload via URL copy
    if (CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_STREAM_API_TOKEN) {
      try {
        const cfResponse = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/copy`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              url: r2_url,
              meta: {
                name: channel.name,
                channel_id: channel_id,
                source: "r2_auto_sync"
              },
              requireSignedURLs: false
            }),
          }
        );

        const cfResult = await cfResponse.json();

        if (cfResult.success && cfResult.result?.uid) {
          // Update CF upload with UID
          await supabase.from("cf_stream_uploads").update({
            cf_stream_uid: cfResult.result.uid,
            status: "processing",
            started_at: new Date().toISOString()
          }).eq("id", cfUpload.id);

          // Update sync event
          await supabase.from("storage_sync_events").update({
            status: "completed",
            target_url: `https://customer-${CLOUDFLARE_ACCOUNT_ID}.cloudflarestream.com/${cfResult.result.uid}/manifest/video.m3u8`,
            completed_at: new Date().toISOString(),
            sync_duration_ms: Date.now() - new Date(syncEvent.created_at).getTime(),
            metadata: { 
              ...syncEvent.metadata,
              cf_stream_uid: cfResult.result.uid
            }
          }).eq("id", syncEvent.id);

          console.log(`[R2→CF] Successfully triggered CF Stream upload: ${cfResult.result.uid}`);

          return new Response(JSON.stringify({
            success: true,
            cf_stream_uid: cfResult.result.uid,
            cf_upload_id: cfUpload.id,
            sync_event_id: syncEvent.id
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } else {
          const errorMsg = cfResult.errors?.[0]?.message || "CF Stream API error";
          await supabase.from("cf_stream_uploads").update({
            status: "failed",
            error_message: errorMsg
          }).eq("id", cfUpload.id);

          await supabase.from("storage_sync_events").update({
            status: "failed",
            error_message: errorMsg
          }).eq("id", syncEvent.id);

          throw new Error(errorMsg);
        }
      } catch (cfError: any) {
        console.error("[R2→CF] CF Stream API error:", cfError);
        await supabase.from("storage_sync_events").update({
          status: "failed",
          error_message: cfError.message
        }).eq("id", syncEvent.id);
        throw cfError;
      }
    } else {
      // No CF credentials - mark as completed without CF upload
      await supabase.from("storage_sync_events").update({
        status: "failed",
        error_message: "CF Stream credentials not configured"
      }).eq("id", syncEvent.id);

      return new Response(JSON.stringify({ 
        error: "CF Stream not configured",
        sync_event_id: syncEvent.id 
      }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

  } catch (error: any) {
    console.error("[R2→CF] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
