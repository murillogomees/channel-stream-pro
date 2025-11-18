import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://sdvyxdghxqmntyoweqbd.supabase.co',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface RetryQueueItem {
  id: string;
  cliente_id: string;
  attempt_count: number;
  max_attempts: number;
  last_error: string;
  error_details: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔄 Starting retry queue processing...');

    // Get pending retries that are ready to be processed
    const { data: pendingRetries, error: fetchError } = await supabase
      .from('smartone_sync_retry_queue')
      .select('*, clientes(id, nome, mac_smart_one, plano, situacao, profiles:user_id(nome, telefone, email))')
      .in('status', ['pending', 'retrying'])
      .or('next_retry_at.is.null,next_retry_at.lte.' + new Date().toISOString())
      .lt('attempt_count', supabase.rpc('max_attempts'))
      .order('created_at', { ascending: true })
      .limit(10);

    if (fetchError) {
      console.error('❌ Error fetching retry queue:', fetchError);
      throw fetchError;
    }

    if (!pendingRetries || pendingRetries.length === 0) {
      console.log('✅ No pending retries to process');
      return new Response(
        JSON.stringify({ message: 'No pending retries', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Found ${pendingRetries.length} items to retry`);

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (const retry of pendingRetries) {
      try {
        console.log(`🔄 Processing retry for cliente ${retry.cliente_id}, attempt ${retry.attempt_count + 1}/${retry.max_attempts}`);

        // Mark as retrying
        await supabase
          .from('smartone_sync_retry_queue')
          .update({ status: 'retrying' })
          .eq('id', retry.id);

        // Call the sync-new-client edge function
        const { data: syncResult, error: syncError } = await supabase.functions.invoke('sync-new-client', {
          body: {
            clienteId: retry.cliente_id,
            nome: retry.clientes.profiles?.nome || retry.clientes.nome,
            telefone: retry.clientes.profiles?.telefone || '',
            email: retry.clientes.profiles?.email || '',
            mac: retry.clientes.mac_smart_one,
            plano: retry.clientes.plano,
            situacao: retry.clientes.situacao
          }
        });

        if (syncError || !syncResult?.success) {
          throw new Error(syncError?.message || syncResult?.message || 'Sync failed');
        }

        // Success! Mark as succeeded and remove from queue
        await supabase
          .from('smartone_sync_retry_queue')
          .update({ status: 'succeeded' })
          .eq('id', retry.id);

        console.log(`✅ Retry succeeded for cliente ${retry.cliente_id}`);
        succeeded++;

      } catch (error: any) {
        console.error(`❌ Retry failed for cliente ${retry.cliente_id}:`, error.message);

        const newAttemptCount = retry.attempt_count + 1;
        const isExhausted = newAttemptCount >= retry.max_attempts;

        // Calculate next retry with exponential backoff: 2^attempt minutes
        const backoffMinutes = Math.pow(2, newAttemptCount);
        const nextRetry = new Date();
        nextRetry.setMinutes(nextRetry.getMinutes() + backoffMinutes);

        if (isExhausted) {
          // Mark as exhausted and notify admins
          await supabase
            .from('smartone_sync_retry_queue')
            .update({
              status: 'exhausted',
              attempt_count: newAttemptCount,
              last_error: error.message,
              error_details: { error: error.message, timestamp: new Date().toISOString() }
            })
            .eq('id', retry.id);

          // Create security event for admin notification
          await supabase
            .from('security_events')
            .insert({
              event_type: 'smartone_sync_failed',
              severity: 'warning',
              event_details: {
                cliente_id: retry.cliente_id,
                cliente_nome: retry.clientes.profiles?.nome || retry.clientes.nome,
                mac: retry.clientes.mac_smart_one,
                attempts: newAttemptCount,
                last_error: error.message,
                message: `SmartOne sync falhou após ${retry.max_attempts} tentativas para o cliente ${retry.clientes.profiles?.nome || retry.clientes.nome}`
              }
            });

          console.log(`🚨 Retry exhausted for cliente ${retry.cliente_id} after ${newAttemptCount} attempts`);
        } else {
          // Update retry info with exponential backoff
          await supabase
            .from('smartone_sync_retry_queue')
            .update({
              status: 'pending',
              attempt_count: newAttemptCount,
              next_retry_at: nextRetry.toISOString(),
              last_error: error.message,
              error_details: { error: error.message, timestamp: new Date().toISOString() }
            })
            .eq('id', retry.id);

          console.log(`⏰ Scheduled next retry for cliente ${retry.cliente_id} in ${backoffMinutes} minutes`);
        }

        failed++;
      }

      processed++;
    }

    console.log(`✅ Retry queue processing complete: ${processed} processed, ${succeeded} succeeded, ${failed} failed`);

    return new Response(
      JSON.stringify({
        message: 'Retry queue processed',
        processed,
        succeeded,
        failed
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error processing retry queue:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
