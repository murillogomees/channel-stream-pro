import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://sdvyxdghxqmntyoweqbd.supabase.co',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface RetryQueueItem {
  id: string;
  type: string;
  recipient_phone: string;
  recipient_name?: string;
  message_content: string;
  template_name?: string;
  client_id?: string;
  attempts: number;
  max_attempts: number;
  last_attempt_at?: string;
  next_retry_at: string;
  error_message?: string;
  status: string;
  metadata?: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[Notification Retry Queue] Iniciando processamento');

    // Buscar itens pendentes ou em retry que estão prontos para tentar novamente
    const now = new Date().toISOString();
    const { data: items, error: fetchError } = await supabase
      .from('notification_retry_queue')
      .select('*')
      .in('status', ['pending', 'retrying'])
      .lte('next_retry_at', now)
      .order('created_at', { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error('[Notification Retry Queue] Erro ao buscar itens:', fetchError);
      throw fetchError;
    }

    if (!items || items.length === 0) {
      console.log('[Notification Retry Queue] Nenhum item para processar');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhum item para processar',
          processed: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Notification Retry Queue] Processando ${items.length} itens`);

    let succeeded = 0;
    let failed = 0;
    let exhausted = 0;

    for (const item of items as RetryQueueItem[]) {
      console.log(`[Notification Retry Queue] Processando item ${item.id} (tentativa ${item.attempts + 1}/${item.max_attempts})`);

      try {
        // Tentar enviar a notificação via WhatsApp
        const whatsappAuthkey = Deno.env.get('WHATSAPP_AUTHKEY');
        const whatsappAppkey = Deno.env.get('WHATSAPP_APPKEY');

        if (!whatsappAuthkey || !whatsappAppkey) {
          throw new Error('Credenciais WhatsApp não configuradas');
        }

        const whatsappResponse = await fetch('https://wbot.blue/api/send-message', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'authkey': whatsappAuthkey,
            'appkey': whatsappAppkey,
          },
          body: JSON.stringify({
            phone: item.recipient_phone,
            message: item.message_content,
          }),
        });

        if (!whatsappResponse.ok) {
          const errorText = await whatsappResponse.text();
          throw new Error(`WhatsApp API retornou ${whatsappResponse.status}: ${errorText}`);
        }

        // Sucesso - atualizar para succeeded e remover da fila
        const { error: updateError } = await supabase
          .from('notification_retry_queue')
          .update({
            status: 'succeeded',
            attempts: item.attempts + 1,
            last_attempt_at: new Date().toISOString(),
          })
          .eq('id', item.id);

        if (updateError) {
          console.error(`[Notification Retry Queue] Erro ao atualizar item ${item.id}:`, updateError);
        } else {
          succeeded++;
          console.log(`[Notification Retry Queue] Item ${item.id} enviado com sucesso`);
        }

        // Log da notificação bem-sucedida
        await supabase
          .from('notification_logs')
          .insert([{
            cliente_id: item.client_id,
            phone: item.recipient_phone,
            message_content: item.message_content,
            template_name: item.template_name,
            status: 'success',
            sent_at: new Date().toISOString(),
          }]);

      } catch (error: any) {
        const newAttempts = item.attempts + 1;

        if (newAttempts >= item.max_attempts) {
          // Esgotou as tentativas
          const { error: exhaustError } = await supabase
            .from('notification_retry_queue')
            .update({
              status: 'exhausted',
              attempts: newAttempts,
              last_attempt_at: new Date().toISOString(),
              error_message: error.message || 'Erro desconhecido',
              error_details: { error: error.toString() },
            })
            .eq('id', item.id);

          if (exhaustError) {
            console.error(`[Notification Retry Queue] Erro ao marcar item ${item.id} como exhausted:`, exhaustError);
          } else {
            exhausted++;
            console.error(`[Notification Retry Queue] Item ${item.id} esgotou tentativas: ${error.message}`);
          }

          // Criar evento de segurança para alertar admins
          await supabase
            .from('security_events')
            .insert([{
              event_type: 'notification_retry_exhausted',
              severity: 'warning',
              event_details: {
                retry_queue_item_id: item.id,
                recipient_phone: item.recipient_phone,
                type: item.type,
                attempts: newAttempts,
                error: error.message,
                timestamp: new Date().toISOString(),
              }
            }]);

          // Log da falha final
          await supabase
            .from('notification_logs')
            .insert([{
              cliente_id: item.client_id,
              phone: item.recipient_phone,
              message_content: item.message_content,
              template_name: item.template_name,
              status: 'error',
              error_message: `Falha após ${newAttempts} tentativas: ${error.message}`,
              sent_at: new Date().toISOString(),
            }]);
        } else {
          // Agendar próxima tentativa com backoff exponencial
          const backoffMinutes = Math.pow(2, newAttempts); // 2, 4, 8, 16, 32 minutos
          const nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();

          const { error: retryError } = await supabase
            .from('notification_retry_queue')
            .update({
              status: 'retrying',
              attempts: newAttempts,
              last_attempt_at: new Date().toISOString(),
              next_retry_at: nextRetryAt,
              error_message: error.message || 'Erro desconhecido',
              error_details: { error: error.toString() },
            })
            .eq('id', item.id);

          if (retryError) {
            console.error(`[Notification Retry Queue] Erro ao atualizar retry do item ${item.id}:`, retryError);
          } else {
            failed++;
            console.error(`[Notification Retry Queue] Item ${item.id} falhou, agendado para retry em ${backoffMinutes} minutos`);
          }
        }
      }
    }

    console.log(`[Notification Retry Queue] Processamento concluído: ${succeeded} sucesso, ${failed} falhas, ${exhausted} esgotados`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processados ${items.length} itens`,
        stats: {
          total: items.length,
          succeeded,
          failed,
          exhausted,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Notification Retry Queue] Erro:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Erro desconhecido ao processar retry queue' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
