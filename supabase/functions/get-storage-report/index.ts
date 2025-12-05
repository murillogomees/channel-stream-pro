import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Cloudflare pricing constants
const PRICING = {
  R2: {
    STORAGE_PER_GB: 0.015, // $0.015/GB/month
    CLASS_A_PER_MILLION: 4.50, // PUT, POST, LIST
    CLASS_B_PER_MILLION: 0.36, // GET
    EGRESS: 0, // Free egress!
  },
  CF_STREAM: {
    ENCODING_PER_MINUTE: 0.01, // $0.01/min encoded
    STORAGE_PER_MINUTE: 0.005, // $0.005/min stored/month
    DELIVERY_PER_1000_MIN: 1.00, // $1/1000 minutes watched
  }
};

interface StorageReport {
  summary: {
    r2_total_bytes: number;
    r2_object_count: number;
    cf_total_bytes: number;
    cf_object_count: number;
    cf_total_minutes: number;
    combined_total_bytes: number;
    combined_object_count: number;
  };
  costs: {
    r2_storage: number;
    r2_operations: number;
    cf_encoding: number;
    cf_storage: number;
    cf_delivery: number;
    total_monthly: number;
    projected_annual: number;
  };
  monthly_evolution: Array<{
    month: string;
    r2_bytes: number;
    r2_count: number;
    cf_bytes: number;
    cf_count: number;
    cost: number;
  }>;
  recent_syncs: Array<{
    id: string;
    channel_id: string;
    source_type: string;
    target_type: string;
    status: string;
    created_at: string;
    file_size_bytes: number;
  }>;
  distribution: {
    by_type: Array<{ type: string; count: number; bytes: number }>;
    by_status: Array<{ status: string; count: number }>;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Auth verification
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
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
    }

    console.log("[Storage Report] Generating consolidated report...");

    // Get R2 stats
    const { data: r2Data } = await supabase
      .from("r2_storage_objects")
      .select("size_bytes, status, content_type, access_count, bandwidth_bytes")
      .eq("status", "ready");

    const r2Objects = r2Data || [];
    const r2TotalBytes = r2Objects.reduce((sum, obj) => sum + (obj.size_bytes || 0), 0);
    const r2TotalBandwidth = r2Objects.reduce((sum, obj) => sum + (obj.bandwidth_bytes || 0), 0);
    const r2AccessCount = r2Objects.reduce((sum, obj) => sum + (obj.access_count || 0), 0);

    // Get CF Stream stats
    const { data: cfData } = await supabase
      .from("cf_stream_uploads")
      .select("metadata, status")
      .eq("status", "ready");

    const cfObjects = cfData || [];
    const cfTotalBytes = cfObjects.reduce((sum, obj) => {
      const sizeBytes = obj.metadata?.size_bytes || obj.metadata?.input?.size || 0;
      return sum + sizeBytes;
    }, 0);
    const cfTotalMinutes = cfObjects.reduce((sum, obj) => {
      const duration = obj.metadata?.duration_seconds || obj.metadata?.input?.duration || 0;
      return sum + (duration / 60);
    }, 0);

    // Calculate costs
    const r2StorageCost = (r2TotalBytes / 1073741824) * PRICING.R2.STORAGE_PER_GB;
    const r2OperationsCost = (r2AccessCount / 1000000) * PRICING.R2.CLASS_B_PER_MILLION;
    const cfEncodingCost = cfTotalMinutes * PRICING.CF_STREAM.ENCODING_PER_MINUTE;
    const cfStorageCost = cfTotalMinutes * PRICING.CF_STREAM.STORAGE_PER_MINUTE;
    const cfDeliveryCost = 0; // Would need actual delivery stats
    const totalMonthlyCost = r2StorageCost + r2OperationsCost + cfEncodingCost + cfStorageCost + cfDeliveryCost;

    // Get monthly evolution
    const { data: monthlyData } = await supabase
      .from("storage_monthly_stats")
      .select("*")
      .order("month", { ascending: false })
      .limit(12);

    const monthlyEvolution = (monthlyData || []).map(m => ({
      month: m.month,
      r2_bytes: m.r2_total_bytes,
      r2_count: m.r2_objects_count,
      cf_bytes: m.cf_total_bytes,
      cf_count: m.cf_objects_count,
      cost: m.estimated_cost_usd
    })).reverse();

    // Get recent sync events
    const { data: syncData } = await supabase
      .from("storage_sync_events")
      .select("id, channel_id, source_type, target_type, status, created_at, file_size_bytes")
      .order("created_at", { ascending: false })
      .limit(20);

    // Distribution by content type
    const typeDistribution: Record<string, { count: number; bytes: number }> = {};
    r2Objects.forEach(obj => {
      const type = obj.content_type?.split('/')[0] || 'unknown';
      if (!typeDistribution[type]) {
        typeDistribution[type] = { count: 0, bytes: 0 };
      }
      typeDistribution[type].count++;
      typeDistribution[type].bytes += obj.size_bytes || 0;
    });

    // Distribution by status
    const { data: allR2 } = await supabase
      .from("r2_storage_objects")
      .select("status");
    const { data: allCf } = await supabase
      .from("cf_stream_uploads")
      .select("status");

    const statusCounts: Record<string, number> = {};
    [...(allR2 || []), ...(allCf || [])].forEach(obj => {
      const status = obj.status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    // Update monthly stats
    await supabase.rpc("calculate_storage_monthly_stats");

    const report: StorageReport = {
      summary: {
        r2_total_bytes: r2TotalBytes,
        r2_object_count: r2Objects.length,
        cf_total_bytes: cfTotalBytes,
        cf_object_count: cfObjects.length,
        cf_total_minutes: cfTotalMinutes,
        combined_total_bytes: r2TotalBytes + cfTotalBytes,
        combined_object_count: r2Objects.length + cfObjects.length
      },
      costs: {
        r2_storage: Number(r2StorageCost.toFixed(2)),
        r2_operations: Number(r2OperationsCost.toFixed(2)),
        cf_encoding: Number(cfEncodingCost.toFixed(2)),
        cf_storage: Number(cfStorageCost.toFixed(2)),
        cf_delivery: Number(cfDeliveryCost.toFixed(2)),
        total_monthly: Number(totalMonthlyCost.toFixed(2)),
        projected_annual: Number((totalMonthlyCost * 12).toFixed(2))
      },
      monthly_evolution: monthlyEvolution,
      recent_syncs: syncData || [],
      distribution: {
        by_type: Object.entries(typeDistribution).map(([type, data]) => ({
          type,
          count: data.count,
          bytes: data.bytes
        })),
        by_status: Object.entries(statusCounts).map(([status, count]) => ({
          status,
          count
        }))
      }
    };

    console.log("[Storage Report] Report generated successfully");

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[Storage Report] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
