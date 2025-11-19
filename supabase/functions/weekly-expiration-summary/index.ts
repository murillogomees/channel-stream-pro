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
      return new Response(
        JSON.stringify({ error: "WhatsApp não configurado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar clientes que vencem nos próximos 7 dias
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    const todayStr = today.toISOString().split('T')[0];
    const nextWeekStr = nextWeek.toISOString().split('T')[0];

    const { data: clientes, error } = await supabase
      .from("clientes")
      .select("*")
      .gte("data_vencimento", todayStr)
      .lte("data_vencimento", nextWeekStr)
      .in("situacao", ["Ativo", "Testando", "Devendo"])
      .order("data_vencimento", { ascending: true });

    if (error) {
      throw error;
    }

    if (!clientes || clientes.length === 0) {
      console.log("Nenhum vencimento na próxima semana");
      return new Response(
        JSON.stringify({ message: "Nenhum vencimento na semana", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Encontrados ${clientes.length} vencimentos para a semana`);

    // Agrupar por dia da semana
    const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const clientesPorDia: Record<string, Cliente[]> = {};
    
    clientes.forEach((cliente: Cliente) => {
      const dataVenc = new Date(cliente.data_vencimento);
      const dataKey = dataVenc.toISOString().split('T')[0];
      
      if (!clientesPorDia[dataKey]) {
        clientesPorDia[dataKey] = [];
      }
      clientesPorDia[dataKey].push(cliente);
    });

    // Buscar telefones de admins
    const { data: admins, error: adminError } = await supabase
      .from("admin_phones")
      .select("phone, name")
      .eq("active", true);

    if (adminError || !admins || admins.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhum admin configurado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Formatar mensagem
    const startDate = today.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const endDate = nextWeek.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    
    let message = `📅 *RESUMO SEMANAL*\n`;
    message += `Semana de ${startDate} a ${endDate}\n\n`;
    message += `Total da semana: *${clientes.length} vencimentos*\n\n`;

    // Percorrer cada dia
    const sortedDates = Object.keys(clientesPorDia).sort();
    sortedDates.forEach((dateStr) => {
      const clientesDia = clientesPorDia[dateStr];
      const date = new Date(dateStr + 'T12:00:00');
      const diaSemana = diasSemana[date.getDay()];
      const dataFormatada = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

      const ativos = clientesDia.filter(c => c.situacao === 'Ativo').length;
      const testando = clientesDia.filter(c => c.situacao === 'Testando').length;
      const devendo = clientesDia.filter(c => c.situacao === 'Devendo').length;
      const receitaDia = clientesDia
        .filter(c => c.situacao === 'Ativo')
        .reduce((sum, c) => sum + (c.valor_pago || 0), 0);

      message += `📍 *${diaSemana.toUpperCase()} (${dataFormatada})* - ${clientesDia.length} clientes\n`;
      message += `   • ${ativos} Ativos`;
      if (testando > 0) message += ` | ${testando} Testando`;
      if (devendo > 0) message += ` | ${devendo} Devendo`;
      message += `\n`;
      message += `   • Receita esperada: R$ ${receitaDia.toFixed(2)}\n\n`;
    });

    // Destaques
    const recorrentes = clientes.filter(c => c.is_recorrente && c.situacao === 'Ativo');
    const maiorValor = clientes
      .filter(c => c.situacao === 'Ativo')
      .sort((a, b) => (b.valor_pago || 0) - (a.valor_pago || 0))[0];
    const clientesRisco = clientes.filter(c => c.situacao === 'Devendo');

    message += `🎯 *DESTAQUES:*\n`;
    if (recorrentes.length > 0) {
      message += `⭐ ${recorrentes.length} clientes recorrentes\n`;
    }
    if (maiorValor) {
      message += `💰 Maior valor: ${maiorValor.nome} - R$ ${maiorValor.valor_pago?.toFixed(2)} (${maiorValor.plano})\n`;
    }
    if (clientesRisco.length > 0) {
      message += `⚠️ ${clientesRisco.length} clientes em risco (devendo)\n`;
    }

    // Projeção total
    const receitaTotal = clientes
      .filter(c => c.situacao === 'Ativo')
      .reduce((sum, c) => sum + (c.valor_pago || 0), 0);
    message += `\n💵 *PROJEÇÃO TOTAL: R$ ${receitaTotal.toFixed(2)}*`;

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
          console.log(`✅ Resumo semanal enviado para: ${admin.name}`);
        } else {
          console.error(`❌ Erro ao enviar para ${admin.name}: ${response.status}`);
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Erro ao enviar para ${admin.name}:`, error);
      }
    }

    // Registrar atividade
    await supabase.from('activity_logs').insert({
      user_id: null,
      action_type: 'weekly_summary_sent',
      action_description: `Resumo semanal enviado para ${sentCount} administradores`,
      entity_type: 'notification',
      metadata: {
        total_vencimentos: clientes.length,
        recorrentes: recorrentes.length,
        receita_projetada: receitaTotal,
        admins_notificados: sentCount
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        vencimentos_semana: clientes.length,
        admins_notificados: sentCount,
        receita_projetada: receitaTotal
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erro no resumo semanal:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
