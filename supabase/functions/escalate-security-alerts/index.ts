import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://sdvyxdghxqmntyoweqbd.supabase.co',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface EscalationRule {
  id: string;
  rule_name: string;
  event_type: string;
  severity_level: string;
  time_window_minutes: number;
  escalation_action: string;
  secondary_admin_ids: string[] | null;
  enabled: boolean;
}

interface AlertDelivery {
  id: string;
  security_event_id: string;
  admin_phone_id: string;
  sent_at: string;
  confirmed_at: string | null;
  escalated: boolean;
  security_events?: {
    event_type: string;
    severity: string;
    created_at: string;
  };
}

interface AdminPhone {
  id: string;
  name: string;
  phone: string;
  active: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[EscalateAlerts] Iniciando verificação de alertas...');

    // 1. Buscar regras de escalonamento ativas
    const { data: rules, error: rulesError } = await supabase
      .from('security_alert_escalation_rules')
      .select('*')
      .eq('enabled', true);

    if (rulesError) {
      throw new Error(`Erro ao buscar regras: ${rulesError.message}`);
    }

    if (!rules || rules.length === 0) {
      console.log('[EscalateAlerts] Nenhuma regra ativa encontrada');
      return new Response(
        JSON.stringify({ message: 'Nenhuma regra ativa' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let escalatedCount = 0;

    // 2. Para cada regra, verificar entregas não confirmadas
    for (const rule of rules as EscalationRule[]) {
      const windowTime = new Date();
      windowTime.setMinutes(windowTime.getMinutes() - rule.time_window_minutes);

      // Buscar entregas não confirmadas dentro da janela de tempo
      const { data: deliveries, error: deliveriesError } = await supabase
        .from('security_alert_deliveries')
        .select(`
          *,
          security_events!inner(event_type, severity, created_at)
        `)
        .is('confirmed_at', null)
        .eq('escalated', false)
        .lte('sent_at', windowTime.toISOString());

      if (deliveriesError) {
        console.error(`[EscalateAlerts] Erro ao buscar entregas:`, deliveriesError);
        continue;
      }

      if (!deliveries || deliveries.length === 0) {
        continue;
      }

      // Filtrar por tipo de evento e severidade da regra
      const filteredDeliveries = deliveries.filter((d: any) => {
        return d.security_events.event_type === rule.event_type &&
               d.security_events.severity === rule.severity_level;
      });

      console.log(`[EscalateAlerts] Encontradas ${filteredDeliveries.length} entregas para escalar (regra: ${rule.rule_name})`);

      // 3. Escalar cada entrega não confirmada
      for (const delivery of filteredDeliveries as AlertDelivery[]) {
        try {
          await escalateAlert(supabase, delivery, rule);
          escalatedCount++;
        } catch (error) {
          console.error(`[EscalateAlerts] Erro ao escalar delivery ${delivery.id}:`, error);
        }
      }
    }

    console.log(`[EscalateAlerts] Finalizado. Total escalonado: ${escalatedCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        escalated_count: escalatedCount,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[EscalateAlerts] Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function escalateAlert(
  supabase: any,
  delivery: AlertDelivery,
  rule: EscalationRule
): Promise<void> {
  console.log(`[EscalateAlerts] Escalonando alerta: ${delivery.id}`);

  // 1. Marcar delivery como escalonado
  await supabase
    .from('security_alert_deliveries')
    .update({
      escalated: true,
      escalated_at: new Date().toISOString(),
      delivery_status: 'escalated',
    })
    .eq('id', delivery.id);

  // 2. Buscar admins para escalonamento
  let targetAdmins: AdminPhone[] = [];

  if (rule.escalation_action === 'notify_all') {
    // Notificar todos os admins ativos (exceto quem já recebeu)
    const { data: allAdmins } = await supabase
      .from('admin_phones')
      .select('*')
      .eq('active', true)
      .neq('id', delivery.admin_phone_id);

    targetAdmins = allAdmins || [];
  } else if (rule.escalation_action === 'notify_secondary' && rule.secondary_admin_ids) {
    // Notificar admins específicos
    const { data: secondaryAdmins } = await supabase
      .from('admin_phones')
      .select('*')
      .in('id', rule.secondary_admin_ids)
      .eq('active', true);

    targetAdmins = secondaryAdmins || [];
  }

  if (targetAdmins.length === 0) {
    console.log('[EscalateAlerts] Nenhum admin disponível para escalonamento');
    return;
  }

  // 3. Buscar evento completo
  const { data: event } = await supabase
    .from('security_events')
    .select('*')
    .eq('id', delivery.security_event_id)
    .single();

  if (!event) {
    console.error('[EscalateAlerts] Evento não encontrado:', delivery.security_event_id);
    return;
  }

  // 4. Buscar template de mensagem
  const { data: template } = await supabase
    .from('security_alert_templates')
    .select('*')
    .eq('event_type', event.event_type)
    .eq('enabled', true)
    .single();

  // 5. Formatar mensagem de escalonamento
  const escalationPrefix = `⚠️ *ALERTA ESCALONADO* ⚠️\n_Alerta crítico não confirmado após ${rule.time_window_minutes} minutos_\n\n`;
  
  let message = escalationPrefix;
  
  if (template) {
    message += fillTemplate(template.message_template, event);
  } else {
    message += formatDefaultMessage(event);
  }

  // 6. Enviar via WhatsApp para admins
  const whatsappAppKey = Deno.env.get('WHATSAPP_APPKEY');
  const whatsappAuthKey = Deno.env.get('WHATSAPP_AUTHKEY');

  if (!whatsappAppKey || !whatsappAuthKey) {
    console.error('[EscalateAlerts] WhatsApp não configurado');
    return;
  }

  for (const admin of targetAdmins) {
    try {
      const response = await fetch('https://api.botbot.com.br/waboxapp/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appkey: whatsappAppKey,
          authkey: whatsappAuthKey,
          to: admin.phone,
          message: message,
        }),
      });

      if (response.ok) {
        // Registrar nova entrega
        await supabase
          .from('security_alert_deliveries')
          .insert({
            security_event_id: delivery.security_event_id,
            admin_phone_id: admin.id,
            delivery_status: 'escalated_sent',
          });

        console.log(`[EscalateAlerts] Escalonado para: ${admin.name}`);
      } else {
        console.error(`[EscalateAlerts] Falha ao enviar para ${admin.name}`);
      }
    } catch (error) {
      console.error(`[EscalateAlerts] Erro ao enviar para ${admin.name}:`, error);
    }
  }
}

function fillTemplate(template: string, event: any): string {
  const timestamp = new Date(event.created_at).toLocaleString('pt-BR');
  
  let message = template;
  message = message.replace(/{timestamp}/g, timestamp);
  message = message.replace(/{severity}/g, event.severity.toUpperCase());
  message = message.replace(/{ip_address}/g, event.ip_address || 'N/A');
  message = message.replace(/{event_type}/g, event.event_type);

  if (event.event_details) {
    const details = event.event_details as any;
    message = message.replace(/{email}/g, details.email || 'N/A');
    message = message.replace(/{old_role}/g, details.old_role || 'N/A');
    message = message.replace(/{new_role}/g, details.new_role || 'N/A');
    message = message.replace(/{description}/g, details.description || 'N/A');
    message = message.replace(/{endpoint}/g, details.endpoint || 'N/A');
    message = message.replace(/{resource}/g, details.resource || 'N/A');
  }

  return message;
}

function formatDefaultMessage(event: any): string {
  const timestamp = new Date(event.created_at).toLocaleString('pt-BR');
  const severityEmoji = event.severity === 'critical' ? '🚨' : '⚠️';
  
  let message = `${severityEmoji} *ALERTA DE SEGURANÇA*\n\n`;
  message += `*Tipo:* ${event.event_type}\n`;
  message += `*Severidade:* ${event.severity.toUpperCase()}\n`;
  message += `*Data/Hora:* ${timestamp}\n`;

  if (event.ip_address) {
    message += `*IP:* ${event.ip_address}\n`;
  }

  message += `\n_Acesse o painel de segurança para mais detalhes._`;

  return message;
}
