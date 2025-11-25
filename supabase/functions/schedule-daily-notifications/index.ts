import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-cron-secret',
};

interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  data_vencimento: string;
  situacao: string;
  plano: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const cronSecret = req.headers.get('x-supabase-cron-secret');
    if (cronSecret !== Deno.env.get('CRON_SECRET')) {
      console.error('[ScheduleDaily] Unauthorized cron attempt');
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('[ScheduleDaily] Iniciando agendamento diário de notificações');

    // Buscar configuração de auto-notificação
    const { data: config } = await supabase
      .from('auto_notification_config')
      .select('*')
      .single();

    if (!config?.enabled) {
      console.log('[ScheduleDaily] Auto-notificação desabilitada');
      return new Response(
        JSON.stringify({ message: 'Auto-notificação desabilitada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const daysToNotify = config.days_to_notify || [7, 3, 1, 0, -3];
    console.log(`[ScheduleDaily] Dias configurados: ${daysToNotify.join(', ')}`);

    // Buscar clientes ativos
    const { data: clientes, error: clientesError } = await supabase
      .from('clientes')
      .select('*')
      .eq('cliente_ativo', true)
      .not('data_vencimento', 'is', null)
      .not('telefone', 'is', null);

    if (clientesError) throw clientesError;

    console.log(`[ScheduleDaily] Encontrados ${clientes?.length || 0} clientes`);

    let notificationsScheduled = 0;
    const today = new Date();
    today.setHours(config.send_hour || 9, 0, 0, 0);

    for (const cliente of (clientes || [])) {
      const dataVencimento = new Date(cliente.data_vencimento);
      const diffDays = Math.floor(
        (dataVencimento.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Verificar se deve agendar notificação para este cliente hoje
      if (daysToNotify.includes(diffDays)) {
        // Verificar se já existe notificação agendada para hoje
        const { data: existing } = await supabase
          .from('notification_schedule')
          .select('id')
          .eq('cliente_id', cliente.id)
          .eq('days_before_due', diffDays)
          .gte('scheduled_for', today.toISOString())
          .lt('scheduled_for', new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString())
          .single();

        if (!existing) {
          const { error: scheduleError } = await supabase
            .from('notification_schedule')
            .insert({
              cliente_id: cliente.id,
              notification_type: 'expiration',
              days_before_due: diffDays,
              scheduled_for: today.toISOString(),
              metadata: {
                cliente_nome: cliente.nome,
                telefone: cliente.telefone,
                data_vencimento: cliente.data_vencimento,
                plano: cliente.plano,
                situacao: cliente.situacao
              }
            });

          if (!scheduleError) {
            notificationsScheduled++;
            console.log(`[ScheduleDaily] Agendada notificação para ${cliente.nome} (${diffDays} dias)`);
          } else {
            console.error(`[ScheduleDaily] Erro ao agendar para ${cliente.nome}:`, scheduleError);
          }
        }
      }
    }

    console.log(`[ScheduleDaily] Total de notificações agendadas: ${notificationsScheduled}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Agendadas ${notificationsScheduled} notificações`,
        date: today.toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ScheduleDaily] Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
