import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  plano: string;
  valor_pago: number;
  situacao: string;
  is_recorrente: boolean;
  forma_ultimo_pagamento: string;
  data_vencimento: string;
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

    // Buscar clientes com vencimento hoje
    const today = new Date().toISOString().split('T')[0];
    const { data: clientes, error } = await supabase
      .from("clientes")
      .select("*")
      .gte("data_vencimento", today)
      .lt("data_vencimento", `${today}T23:59:59`)
      .in("situacao", ["Ativo", "Testando", "Devendo"]);

    if (error) {
      throw error;
    }

    if (!clientes || clientes.length === 0) {
      console.log("Nenhum vencimento hoje");
      return new Response(
        JSON.stringify({ message: "Nenhum vencimento hoje", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Encontrados ${clientes.length} vencimentos para hoje`);

    // Agrupar por situação
    const ativos = clientes.filter((c: Cliente) => c.situacao === "Ativo");
    const testando = clientes.filter((c: Cliente) => c.situacao === "Testando");
    const devendo = clientes.filter((c: Cliente) => c.situacao === "Devendo");

    // Buscar telefones de admins
    const { data: admins, error: adminError } = await supabase
      .from("admin_phones")
      .select("phone, name")
      .eq("active", true);

    if (adminError || !admins || admins.length === 0) {
      console.log("Nenhum admin para notificar");
      return new Response(
        JSON.stringify({ error: "Nenhum admin configurado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Formatar mensagem
    const dateStr = new Date().toLocaleDateString('pt-BR');
    let message = `📊 *RESUMO DIÁRIO - ${dateStr}*\n`;
    message += `Vencimentos de hoje: *${clientes.length} clientes*\n\n`;

    // Ativos
    if (ativos.length > 0) {
      message += `🟢 *ATIVOS (${ativos.length}):*\n`;
      ativos.forEach((c: Cliente, i: number) => {
        message += `${i + 1}. ${c.nome} - ${c.plano} - R$ ${c.valor_pago?.toFixed(2) || '0.00'}\n`;
        message += `   Recorrente: ${c.is_recorrente ? 'Sim' : 'Não'} | `;
        message += `Últ. Pgto: ${c.forma_ultimo_pagamento || 'N/A'}\n`;
        message += `   Tel: ${c.telefone}\n\n`;
      });
    }

    // Testando
    if (testando.length > 0) {
      message += `🟡 *TESTANDO (${testando.length}):*\n`;
      testando.forEach((c: Cliente, i: number) => {
        message += `${i + 1}. ${c.nome} - Período de teste\n`;
        message += `   Tel: ${c.telefone}\n\n`;
      });
    }

    // Devendo
    if (devendo.length > 0) {
      message += `🔴 *DEVENDO (${devendo.length}):*\n`;
      devendo.forEach((c: Cliente, i: number) => {
        message += `${i + 1}. ${c.nome} - ${c.plano}\n`;
        message += `   ⚠️ ATENÇÃO: Cliente com pagamento pendente\n`;
        message += `   Tel: ${c.telefone}\n\n`;
      });
    }

    // Total a receber
    const totalReceita = ativos.reduce((sum, c) => sum + (c.valor_pago || 0), 0);
    message += `\n💵 *Total a receber hoje: R$ ${totalReceita.toFixed(2)}*`;

    // Enviar para todos os admins
    const BOTBOT_API_URL = "https://botbot.chat/api/create-message";
    let sentCount = 0;

    for (const admin of admins) {
      try {
        const formData = new FormData();
        formData.append("appkey", whatsappAppkey);
        formData.append("authkey", whatsappAuthkey);
        formData.append("to", admin.phone);
        formData.append("message", message);
        formData.append("typingDelay", "2");

        const response = await fetch(BOTBOT_API_URL, {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          sentCount++;
          console.log(`✅ Resumo enviado para: ${admin.name}`);
        } else {
          console.error(`❌ Erro ao enviar para ${admin.name}: ${response.status}`);
        }

        // Delay entre envios
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Erro ao enviar para ${admin.name}:`, error);
      }
    }

    // Registrar atividade
    await supabase.from('activity_logs').insert({
      user_id: null,
      action_type: 'daily_summary_sent',
      action_description: `Resumo diário enviado para ${sentCount} administradores`,
      entity_type: 'notification',
      metadata: {
        total_vencimentos: clientes.length,
        ativos: ativos.length,
        testando: testando.length,
        devendo: devendo.length,
        receita_esperada: totalReceita,
        admins_notificados: sentCount
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        vencimentos: clientes.length,
        admins_notificados: sentCount,
        receita_esperada: totalReceita
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erro no resumo diário:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
