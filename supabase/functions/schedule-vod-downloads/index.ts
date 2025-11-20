import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-cron-secret',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar autenticação via cron secret
    const cronSecret = req.headers.get('x-supabase-cron-secret');
    const expectedSecret = Deno.env.get('CRON_SECRET');

    if (cronSecret !== expectedSecret) {
      console.error('[ScheduleVODDownloads] Unauthorized cron attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🕐 [ScheduleVODDownloads] Iniciando agendamento de downloads de VOD...');

    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Buscar VODs pendentes (marcados como VOD mas não uploadados)
    const { data: pendingVODs, error: pendingError } = await supabaseService
      .from('m3u_channels')
      .select('id, name, stream_url')
      .eq('is_vod', true)
      .eq('r2_uploaded', false)
      .limit(10); // Processar até 10 por execução

    if (pendingError) {
      throw new Error(`Erro ao buscar VODs pendentes: ${pendingError.message}`);
    }

    if (!pendingVODs || pendingVODs.length === 0) {
      console.log('✅ Nenhum VOD pendente para download');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhum VOD pendente',
          scheduled: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 ${pendingVODs.length} VODs pendentes encontrados`);

    // 2. Verificar downloads em andamento
    const { count: activeDownloads } = await supabaseService
      .from('vod_downloads')
      .select('*', { count: 'exact', head: true })
      .in('status', ['downloading', 'processing']);

    const MAX_CONCURRENT_DOWNLOADS = 3;
    const availableSlots = MAX_CONCURRENT_DOWNLOADS - (activeDownloads || 0);

    if (availableSlots <= 0) {
      console.log(`⏸️  Máximo de downloads simultâneos atingido (${activeDownloads}/${MAX_CONCURRENT_DOWNLOADS})`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Máximo de downloads simultâneos atingido',
          scheduled: 0,
          activeDownloads: activeDownloads || 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Agendar novos downloads (até o limite de slots disponíveis)
    const vodsToSchedule = pendingVODs.slice(0, availableSlots);
    let scheduled = 0;

    for (const vod of vodsToSchedule) {
      try {
        // Verificar se já existe download recente falhado
        const { data: recentFailures, error: failureError } = await supabaseService
          .from('vod_downloads')
          .select('retry_count, created_at')
          .eq('channel_id', vod.id)
          .eq('status', 'failed')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        // Se já teve 3 tentativas falhadas, pular
        if (!failureError && recentFailures && recentFailures.retry_count >= 3) {
          console.log(`⚠️  VOD ${vod.name} já teve 3 tentativas falhadas, pulando...`);
          continue;
        }

        // Criar registro de download pendente
        await supabaseService
          .from('vod_downloads')
          .insert({
            channel_id: vod.id,
            original_url: vod.stream_url,
            status: 'pending',
            retry_count: (recentFailures?.retry_count || 0)
          });

        console.log(`✅ VOD agendado: ${vod.name}`);
        scheduled++;

      } catch (scheduleError) {
        console.error(`❌ Erro ao agendar VOD ${vod.name}:`, scheduleError);
      }
    }

    // 4. Processar downloads pendentes via invocação da função download-vod
    const { data: pendingDownloads } = await supabaseService
      .from('vod_downloads')
      .select('id, channel_id')
      .eq('status', 'pending')
      .limit(availableSlots);

    if (pendingDownloads && pendingDownloads.length > 0) {
      console.log(`🚀 Iniciando ${pendingDownloads.length} downloads...`);

      // Invocar download-vod para cada canal (não aguardar resposta)
      for (const download of pendingDownloads) {
        supabaseService.functions.invoke('download-vod', {
          body: { channelId: download.channel_id }
        }).catch(err => {
          console.error(`❌ Erro ao invocar download-vod para canal ${download.channel_id}:`, err);
        });
      }
    }

    // 5. Limpar downloads antigos
    await supabaseService.rpc('cleanup_old_vod_downloads');

    console.log(`✅ [ScheduleVODDownloads] Concluído: ${scheduled} VODs agendados`);

    return new Response(
      JSON.stringify({ 
        success: true,
        scheduled,
        activeDownloads: activeDownloads || 0,
        availableSlots,
        pendingVODs: pendingVODs.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ [ScheduleVODDownloads] Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
