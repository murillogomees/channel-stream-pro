import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-cron-secret',
};

interface WhatsappTemplate {
  id: string;
  name: string;
  message: string;
  eventType: string;
  daysBeforeDue?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const cronSecret = req.headers.get('x-supabase-cron-secret');
    if (cronSecret !== Deno.env.get('CRON_SECRET')) {
      console.error('[ProcessQueue] Unauthorized cron attempt');
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('[ProcessQueue] Iniciando processamento da fila');

    // Buscar notificações pendentes que devem ser enviadas agora
    const { data: pendingNotifications, error: fetchError } = await supabase
      .from('notification_schedule')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(50);

    if (fetchError) throw fetchError;

    console.log(`[ProcessQueue] Encontradas ${pendingNotifications?.length || 0} notificações pendentes`);

    if (!pendingNotifications || pendingNotifications.length === 0) {
      return new Response(
        JSON.stringify({ message: 'Nenhuma notificação pendente' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar configuração do WhatsApp
    const { data: config } = await supabase
      .from('whatsapp_config')
      .select('*')
      .single();

    if (!config?.appkey || !config?.authkey) {
      console.error('[ProcessQueue] Configuração WhatsApp não encontrada');
      return new Response(
        JSON.stringify({ error: 'WhatsApp não configurado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar templates
    const { data: templates } = await supabase
      .from('whatsapp_templates')
      .select('*')
      .eq('active', true);

    let sent = 0;
    let failed = 0;

    for (const notification of pendingNotifications) {
      try {
        const metadata = notification.metadata as any;
        
        // Encontrar template apropriado
        const template = templates?.find(t => 
          t.event_type === 'expiration' && 
          t.days_before_due === notification.days_before_due
        );

        if (!template) {
          console.error(`[ProcessQueue] Template não encontrado para ${notification.days_before_due} dias`);
          await supabase
            .from('notification_schedule')
            .update({ 
              status: 'failed',
              error_message: 'Template não encontrado',
              attempts: (notification.attempts || 0) + 1,
              last_attempt_at: new Date().toISOString()
            })
            .eq('id', notification.id);
          failed++;
          continue;
        }

        // Preencher template com dados do cliente
        let message = template.message;
        if (metadata) {
          message = message
            .replace(/\{nome\}/g, metadata.cliente_nome || '')
            .replace(/\{data_vencimento\}/g, metadata.data_vencimento || '')
            .replace(/\{plano\}/g, metadata.plano || '')
            .replace(/\{dias\}/g, String(Math.abs(notification.days_before_due || 0)));
        }

        // Enviar via WhatsApp
        const response = await fetch('https://api.botbot.chat/api/messages/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'appkey': config.appkey,
            'authkey': config.authkey,
          },
          body: JSON.stringify({
            phone: metadata.telefone,
            message: message,
          }),
        });

        const result = await response.json();

        if (response.ok && result.message_status === 'success') {
          // Sucesso
          await supabase.from('notification_schedule').update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            attempts: (notification.attempts || 0) + 1,
            last_attempt_at: new Date().toISOString()
          }).eq('id', notification.id);

          // Log de sucesso
          await supabase.from('notification_logs').insert({
            cliente_id: notification.cliente_id,
            template_name: template.name,
            phone: metadata.telefone,
            status: 'success',
            message_content: message,
            sent_at: new Date().toISOString()
          });

          sent++;
          console.log(`[ProcessQueue] ✅ Enviado para ${metadata.cliente_nome}`);
        } else {
          throw new Error(result.error || 'Erro ao enviar mensagem');
        }

      } catch (error) {
        console.error(`[ProcessQueue] ❌ Erro ao processar notificação ${notification.id}:`, error);
        
        const attempts = (notification.attempts || 0) + 1;
        const maxAttempts = 3;

        await supabase.from('notification_schedule').update({
          status: attempts >= maxAttempts ? 'failed' : 'pending',
          error_message: error.message,
          attempts: attempts,
          last_attempt_at: new Date().toISOString()
        }).eq('id', notification.id);

        // Log de erro
        await supabase.from('notification_logs').insert({
          cliente_id: notification.cliente_id,
          template_name: 'unknown',
          phone: notification.metadata?.telefone,
          status: 'error',
          message_content: '',
          error_message: error.message,
          sent_at: new Date().toISOString()
        });

        failed++;
      }
    }

    console.log(`[ProcessQueue] Processamento concluído: ${sent} enviadas, ${failed} falharam`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: sent,
        failed: failed,
        total: pendingNotifications.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ProcessQueue] Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
