import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PlaylistHealthCheck {
  id: string;
  client_id: string | null;
  playlist_id: string;
  m3u_url: string;
  status: string;
  error_message: string | null;
  last_checked_at: string;
}

interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  plano: string;
  situacao: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const whatsappAppkey = Deno.env.get("WHATSAPP_APPKEY");
    const whatsappAuthkey = Deno.env.get("WHATSAPP_AUTHKEY");

    if (!whatsappAppkey || !whatsappAuthkey) {
      console.log("Credenciais WhatsApp não configuradas");
      return new Response(
        JSON.stringify({ error: "WhatsApp não configurado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar playlists com erro
    const { data: failedPlaylists, error: playlistError } = await supabase
      .from("playlist_health_checks")
      .select("*")
      .eq("status", "error")
      .order("last_checked_at", { ascending: false });

    if (playlistError) {
      throw playlistError;
    }

    if (!failedPlaylists || failedPlaylists.length === 0) {
      console.log("Nenhuma playlist inativa encontrada");
      return new Response(
        JSON.stringify({ message: "Nenhuma playlist inativa", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Encontradas ${failedPlaylists.length} playlists inativas`);

    // Buscar telefones de admins para notificação
    const { data: adminPhones, error: adminError } = await supabase
      .from("admin_phones")
      .select("phone, name")
      .eq("active", true);

    if (adminError) {
      throw adminError;
    }

    if (!adminPhones || adminPhones.length === 0) {
      console.log("Nenhum telefone de admin configurado");
      return new Response(
        JSON.stringify({ message: "Nenhum admin para notificar" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar informações dos clientes afetados
    const clientIds = failedPlaylists
      .map((p: PlaylistHealthCheck) => p.client_id)
      .filter((id): id is string => id !== null);

    let clientesAfetados: Cliente[] = [];
    if (clientIds.length > 0) {
      const { data: clientes, error: clienteError } = await supabase
        .from("clientes")
        .select("id, nome, telefone, plano, situacao")
        .in("id", clientIds);

      if (!clienteError && clientes) {
        clientesAfetados = clientes;
      }
    }

    // Preparar mensagem de alerta
    const clientesText = clientesAfetados.length > 0
      ? clientesAfetados.map((c) => `• ${c.nome} (${c.plano})`).join("\n")
      : "Nenhum cliente vinculado";

    const message = `🚨 *ALERTA: Playlists Inativas*\n\n` +
      `Foram detectadas *${failedPlaylists.length} playlists com erro*.\n\n` +
      `*Clientes afetados:*\n${clientesText}\n\n` +
      `⚠️ Verifique o painel de Saúde das Playlists para mais detalhes.\n\n` +
      `_Verificação automática - ${new Date().toLocaleString("pt-BR")}_`;

    // Enviar alertas para todos os admins
    let successCount = 0;
    let errorCount = 0;

    for (const admin of adminPhones) {
      try {
        const whatsappResponse = await fetch("https://api.botbot.chat/sendtext", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "appkey": whatsappAppkey,
            "authkey": whatsappAuthkey,
          },
          body: JSON.stringify({
            phone: admin.phone,
            message: message,
          }),
        });

        const result = await whatsappResponse.json();

        if (result.message_status === "Success") {
          successCount++;
          console.log(`Alerta enviado para ${admin.name} (${admin.phone})`);

          // Registrar log de atividade
          await supabase.from("activity_logs").insert({
            action_type: "playlist_alert_sent",
            action_description: `Alerta de playlists inativas enviado para ${admin.name}`,
            entity_type: "alert",
            metadata: {
              admin_phone: admin.phone,
              failed_playlists_count: failedPlaylists.length,
              affected_clients: clientesAfetados.length,
            },
          });
        } else {
          errorCount++;
          console.error(`Erro ao enviar para ${admin.name}:`, result);
        }
      } catch (error) {
        errorCount++;
        console.error(`Erro ao notificar ${admin.name}:`, error);
      }
    }

    return new Response(
      JSON.stringify({
        message: "Alertas processados",
        failed_playlists: failedPlaylists.length,
        alerts_sent: successCount,
        alerts_failed: errorCount,
        affected_clients: clientesAfetados.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro no processamento:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
