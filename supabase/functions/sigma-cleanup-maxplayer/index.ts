/**
 * SIGMA CLEANUP MAXPLAYER
 * 
 * Limpeza automática de contas MaxPlayer redundantes no painel Sigma Blaze.
 * 
 * Critérios de exclusão:
 * 1. ÓRFÃOS: contas MaxPlayer que NÃO possuem conta Blaze IPTV com o mesmo username
 * 2. DUPLICADOS: contas MaxPlayer que possuem conta Blaze IPTV com o mesmo username
 *    E a conta Blaze IPTV tem vencimento > 5 dias no futuro
 * 
 * Delega ao sigma-blaze-client para toda comunicação com o painel (proxy + sessão).
 * Executado via cron diário.
 */
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function callSigmaBlaze(action: string, params: Record<string, unknown> = {}): Promise<any> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const response = await fetch(`${supabaseUrl}/functions/v1/sigma-blaze-client`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${anonKey}`,
      "apikey": anonKey,
    },
    body: JSON.stringify({ action, ...params }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`sigma-blaze-client ${action} failed: ${response.status} - ${JSON.stringify(data)}`);
  }
  return data;
}

async function fetchAllCustomers(): Promise<any[]> {
  const allCustomers: any[] = [];
  let page = 1;
  const perPage = 100;
  let hasMore = true;

  while (hasMore && page <= 50) {
    try {
      const data = await callSigmaBlaze("list_customers", { page, perPage });
      const customers = data?.data || [];
      if (customers.length === 0) break;
      allCustomers.push(...customers);

      const lastPage = data?.meta?.last_page || data?.meta?.lastPage || 1;
      hasMore = page < lastPage;
      page++;
    } catch (err) {
      console.warn(`[CLEANUP_MAXPLAYER] Page ${page} failed, using ${allCustomers.length} partial results:`, err);
      break;
    }
  }

  return allCustomers;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = getSupabase();

  try {
    // 1. Buscar TODOS os clientes via sigma-blaze-client (que já usa proxy + sessão)
    console.log("[CLEANUP_MAXPLAYER] Fetching all clients via sigma-blaze-client...");
    const allClients = await fetchAllCustomers();
    console.log(`[CLEANUP_MAXPLAYER] Total clients fetched: ${allClients.length}`);

    if (allClients.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: "Nenhum cliente encontrado no painel",
        deleted: 0,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Separar clientes Blaze IPTV e MaxPlayer pelo campo package/plan
    const blazeClients: any[] = [];
    const maxPlayerClients: any[] = [];

    for (const c of allClients) {
      const pkg = (c.package || c.plan_name || c.package_name || c.plano || c.plan || "").toLowerCase();
      if (pkg.includes("maxplayer") || pkg.includes("max player") || pkg.includes("max_player")) {
        maxPlayerClients.push(c);
      } else if (pkg.includes("blaze") || pkg.includes("iptv")) {
        blazeClients.push(c);
      }
    }

    console.log(`[CLEANUP_MAXPLAYER] Blaze IPTV: ${blazeClients.length}, MaxPlayer: ${maxPlayerClients.length}`);

    // 3. Construir sets de usernames dos clientes Blaze IPTV
    const allBlazeUsernames = new Set<string>();
    const blazeWithExpGt5Days = new Set<string>();
    const now = new Date();
    const fiveDaysFromNow = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

    for (const c of blazeClients) {
      const username = (c.username || c.login || c.user || c.nome_usuario || "").toLowerCase().trim();
      if (!username) continue;
      allBlazeUsernames.add(username);

      const expStr = c.expires_at || c.expiration_date || c.exp_date || c.data_expiracao || c.due_date || "";
      const expDate = new Date(expStr || "1970-01-01");
      if (expDate > fiveDaysFromNow) {
        blazeWithExpGt5Days.add(username);
      }
    }

    // 4. Identificar MaxPlayer para deletar:
    //    a) Órfãos: MaxPlayer SEM Blaze IPTV correspondente
    //    b) Duplicados: MaxPlayer COM Blaze IPTV que tem vencimento > 5 dias
    const toDelete: any[] = [];
    const orphans: any[] = [];
    const duplicates: any[] = [];

    for (const c of maxPlayerClients) {
      const username = (c.username || c.login || c.user || c.nome_usuario || "").toLowerCase().trim();
      if (!username) continue;

      if (!allBlazeUsernames.has(username)) {
        toDelete.push(c);
        orphans.push(c);
      } else if (blazeWithExpGt5Days.has(username)) {
        toDelete.push(c);
        duplicates.push(c);
      }
    }

    console.log(`[CLEANUP_MAXPLAYER] Orphans: ${orphans.length}, Duplicates (exp>5d): ${duplicates.length}, Total to delete: ${toDelete.length}`);

    // 5. Deletar cada MaxPlayer via sigma-blaze-client (que usa proxy + sessão)
    let deleted = 0;
    let errors = 0;
    const details: any[] = [];

    for (const client of toDelete) {
      const clientId = String(client.id || client.client_id || client.user_id || "");
      const username = client.username || client.login || client.user || client.nome_usuario || "";
      const reason = orphans.includes(client) ? "orphan" : "duplicate_exp_gt_5d";

      try {
        await callSigmaBlaze("delete_customer", { customerId: clientId });
        deleted++;
        details.push({ id: clientId, username, reason, status: "deleted" });
        console.log(`[CLEANUP_MAXPLAYER] Deleted ${username} (${reason})`);
      } catch (e) {
        errors++;
        details.push({ id: clientId, username, reason, status: "error", error: (e as Error).message });
        console.warn(`[CLEANUP_MAXPLAYER] Failed to delete ${username}:`, e);
      }

      // Small delay between deletions to avoid rate limiting
      await new Promise(r => setTimeout(r, 500));
    }

    // 6. Log no banco
    try {
      await supabase.from("sigma_blaze_logs").insert({
        action: "cleanup-maxplayer",
        status: errors === 0 ? "SUCCESS" : "PARTIAL",
        details: {
          total: allClients.length,
          blaze: blazeClients.length,
          maxplayer: maxPlayerClients.length,
          orphans: orphans.length,
          duplicates: duplicates.length,
          deleted,
          errors,
          details: details.slice(0, 100), // Limitar detalhes para não exceder JSONB
        },
      });
    } catch (logErr) {
      console.warn("[CLEANUP_MAXPLAYER] Failed to log to sigma_blaze_logs:", logErr);
    }

    return new Response(JSON.stringify({
      success: true,
      message: `${deleted} MaxPlayer excluídos (${orphans.length} órfãos, ${duplicates.length} duplicados), ${errors} erros`,
      deleted,
      errors,
      orphans: orphans.length,
      duplicates: duplicates.length,
      total: toDelete.length,
      details,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[CLEANUP_MAXPLAYER] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: (error as Error).message,
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
