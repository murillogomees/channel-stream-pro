import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TrackClickPayload {
  ref: string; // affiliate_id or custom_slug
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  landing_page?: string;
  referrer?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { ref, utm_source, utm_medium, utm_campaign, landing_page, referrer } = 
      await req.json() as TrackClickPayload;

    // Get IP and user agent from headers
    const ip_address = req.headers.get("x-forwarded-for")?.split(",")[0] || 
                       req.headers.get("cf-connecting-ip") || 
                       "unknown";
    const user_agent = req.headers.get("user-agent") || "";

    console.log(`[track-affiliate-click] Tracking click for ref: ${ref}`);

    // Find affiliate by ID or custom_slug
    let affiliateId = ref;
    
    // Check if ref is a UUID or a custom slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref);
    
    if (!isUUID) {
      const { data: affiliate, error } = await supabase
        .from("affiliates")
        .select("id")
        .eq("custom_slug", ref)
        .single();

      if (error || !affiliate) {
        return new Response(
          JSON.stringify({ error: "Affiliate not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      affiliateId = affiliate.id;
    }

    // Check for fraud
    const { data: fraudCheck } = await supabase.rpc("check_affiliate_fraud", {
      p_affiliate_id: affiliateId,
      p_ip_address: ip_address,
      p_action_type: "click"
    });

    if (fraudCheck === true) {
      console.log(`[track-affiliate-click] Fraud detected for ${affiliateId}`);
      // Still return success to not reveal fraud detection
    }

    // Track the click
    const { data: clickId, error: trackError } = await supabase.rpc("track_affiliate_click", {
      p_affiliate_id: affiliateId,
      p_ip_address: ip_address,
      p_user_agent: user_agent,
      p_referrer: referrer || null,
      p_utm_source: utm_source || null,
      p_utm_medium: utm_medium || null,
      p_utm_campaign: utm_campaign || null,
      p_landing_page: landing_page || null
    });

    if (trackError) {
      console.error("[track-affiliate-click] Error tracking:", trackError);
      throw trackError;
    }

    console.log(`[track-affiliate-click] Click tracked: ${clickId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        click_id: clickId,
        affiliate_id: affiliateId
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[track-affiliate-click] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
