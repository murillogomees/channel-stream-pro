import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const search = url.searchParams.get("search") || "";
    const status_filter = url.searchParams.get("status") || "active";
    const expiration = url.searchParams.get("expiration") || "all"; // all, green, yellow, red
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20");
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("sigma_blaze_clients")
      .select("*", { count: "exact" })
      .eq("status", status_filter)
      .order("expiration_date", { ascending: true })
      .range(from, to);

    if (search) {
      query = query.or(`name.ilike.%${search}%,whatsapp.ilike.%${search}%`);
    }

    // Expiration filter
    if (expiration !== "all") {
      const now = new Date();
      const twoDays = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
      const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

      if (expiration === "red") {
        query = query.lte("expiration_date", twoDays);
      } else if (expiration === "yellow") {
        query = query.gt("expiration_date", twoDays).lte("expiration_date", sevenDays);
      } else if (expiration === "green") {
        query = query.gt("expiration_date", sevenDays);
      }
    }

    const { data, count, error } = await query;
    if (error) throw error;

    // Map to SigmaClient interface expected by frontend
    const clients = (data || []).map((c: any) => ({
      id: c.id,
      username: c.sigma_id || c.id,
      full_name: c.name,
      phone: c.whatsapp || null,
      package_name: c.plan_name || "Blaze IPTV",
      expiration_date: c.expiration_date,
      status: c.status,
      // Extra fields for compatibility
      email: c.email,
      plan_value: c.plan_value,
      last_reminder_sent: c.last_reminder_sent,
      notes: c.notes,
    }));

    return new Response(
      JSON.stringify({ clients, total: count || 0, page, pageSize }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
