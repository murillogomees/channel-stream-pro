import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { secrets } = await req.json();
    
    if (!Array.isArray(secrets)) {
      return new Response(
        JSON.stringify({ error: "secrets must be an array" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const result: Record<string, { name: string; isConfigured: boolean; loading: boolean }> = {};

    // Verifica se cada secret está configurado (sem expor o valor)
    for (const secretName of secrets) {
      const value = Deno.env.get(secretName);
      result[secretName] = {
        name: secretName,
        isConfigured: !!value && value.length > 0,
        loading: false,
      };
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[check-secrets] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
