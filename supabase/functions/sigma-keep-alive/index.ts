/**
 * SIGMA KEEP-ALIVE - Session Renewal
 * 
 * Renova a sessão do Sigma Blaze proativamente para que nunca expire.
 * Delega ao sigma-blaze-client que já possui toda a lógica de proxy,
 * session-manager e multi-painel.
 * 
 * Executado via cron a cada 45 minutos.
 */
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || serviceRoleKey;

    // Chama o sigma-blaze-client com forceLogin para renovar a sessão
    // Usa o service role key para autenticação interna
    const functionUrl = `${supabaseUrl}/functions/v1/sigma-blaze-client`;
    
    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anonKey}`,
        "apikey": anonKey,
      },
      body: JSON.stringify({
        action: "cron_renew_token",
        forceLogin: true,
      }),
    });

    const data = await response.json().catch(() => ({ error: "Invalid response" }));

    if (response.ok && data?.success !== false) {
      console.log("[SIGMA_KEEP_ALIVE] Session renewed successfully via sigma-blaze-client");
      return new Response(JSON.stringify({
        success: true,
        message: "Sessão renovada com sucesso via sigma-blaze-client",
        details: data,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Se o sigma-blaze-client falhou, logar o erro mas não crashar
    console.warn("[SIGMA_KEEP_ALIVE] sigma-blaze-client returned error:", data);
    return new Response(JSON.stringify({
      success: false,
      error: data?.error || "Falha ao renovar sessão",
      details: data,
    }), {
      status: response.status >= 400 ? response.status : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[SIGMA_KEEP_ALIVE] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: (error as Error).message,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
