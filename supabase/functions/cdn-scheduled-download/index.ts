/**
 * CDN Scheduled Download - Cron job para downloads automáticos
 * 
 * Executar via pg_cron ou chamada HTTP scheduled
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('[Scheduled Download] Checking if should run...');

    // Verificar se agendamento está habilitado
    const { data: config, error: configError } = await supabase
      .from('content_routing_config')
      .select('config_value')
      .eq('config_key', 'cdn_download_schedule')
      .maybeSingle();

    if (configError) throw configError;

    const schedule = config?.config_value as {
      enabled: boolean;
      frequency: string;
      hour: number;
      dayOfWeek: number;
    } | null;

    if (!schedule?.enabled) {
      console.log('[Scheduled Download] Agendamento desabilitado');
      return new Response(
        JSON.stringify({ success: true, message: 'Agendamento desabilitado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se é o horário correto
    const now = new Date();
    const currentHour = now.getUTCHours();
    const currentDay = now.getUTCDay();

    let shouldRun = false;

    if (schedule.frequency === 'hourly') {
      shouldRun = true; // Sempre roda se for hourly
    } else if (schedule.frequency === 'daily') {
      shouldRun = currentHour === schedule.hour;
    } else if (schedule.frequency === 'weekly') {
      shouldRun = currentHour === schedule.hour && currentDay === schedule.dayOfWeek;
    }

    if (!shouldRun) {
      console.log(`[Scheduled Download] Não é hora de rodar (current: ${currentHour}h, scheduled: ${schedule.hour}h)`);
      return new Response(
        JSON.stringify({ success: true, message: 'Fora do horário agendado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Scheduled Download] Iniciando download automático...');

    // Invocar bulk downloader com configurações padrão
    const { data, error } = await supabase.functions.invoke('cdn-bulk-downloader', {
      body: {
        maxChannels: 200,
        contentType: 'all',
        onlyNew: true,
      }
    });

    if (error) throw error;

    // Registrar execução
    await supabase.from('activity_logs').insert({
      action_type: 'cdn_scheduled_download',
      action_description: `Download automático iniciado: ${data.channelsCount} canais`,
      entity_type: 'cdn_prewarm_jobs',
      entity_id: data.jobId,
      metadata: { schedule, result: data }
    });

    console.log(`[Scheduled Download] Sucesso: ${data.channelsCount} canais`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Download automático iniciado: ${data.channelsCount} canais`,
        jobId: data.jobId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Scheduled Download] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
