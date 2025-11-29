import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-cron-secret',
};

// Declaração do EdgeRuntime para Deno
declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar autenticação via cron secret ou admin
    const cronSecret = req.headers.get('x-supabase-cron-secret');
    const authHeader = req.headers.get('authorization');
    const expectedSecret = Deno.env.get('CRON_SECRET');

    const isCronRequest = cronSecret === expectedSecret;
    let isAdminRequest = false;

    if (!isCronRequest && authHeader) {
      const supabaseAuth = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await supabaseAuth.auth.getUser();
      if (user) {
        const { data: isAdmin } = await supabaseAuth.rpc('is_admin', { uid: user.id });
        isAdminRequest = !!isAdmin;
      }
    }

    if (!isCronRequest && !isAdminRequest) {
      console.error('[ScheduleVOD] Unauthorized attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { 
      limit = 20,           // Máximo de VODs por execução
      priority = 'size',    // Priorizar por: 'size' (menores primeiro), 'recent', 'category'
      categoryFilter = null // Filtrar por categoria específica
    } = body;

    console.log(`🕐 [ScheduleVOD] Iniciando - limit: ${limit}, priority: ${priority}`);

    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Verificar downloads ativos
    const { count: activeDownloads } = await supabaseService
      .from('vod_downloads')
      .select('*', { count: 'exact', head: true })
      .in('status', ['downloading', 'processing', 'queued']);

    const MAX_CONCURRENT = 5;
    const availableSlots = Math.max(0, MAX_CONCURRENT - (activeDownloads || 0));

    if (availableSlots === 0) {
      console.log(`⏸️ [ScheduleVOD] Slots esgotados (${activeDownloads}/${MAX_CONCURRENT})`);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Downloads em andamento no limite',
          scheduled: 0,
          activeDownloads: activeDownloads || 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Buscar VODs pendentes com critérios inteligentes
    let query = supabaseService
      .from('m3u_channels')
      .select('id, name, stream_url, category_id, metadata, created_at')
      .eq('is_vod', true)
      .eq('r2_uploaded', false);

    if (categoryFilter) {
      query = query.eq('category_id', categoryFilter);
    }

    // Aplicar ordenação por prioridade
    switch (priority) {
      case 'recent':
        query = query.order('created_at', { ascending: false });
        break;
      case 'category':
        query = query.order('category_id').order('name');
        break;
      default: // 'size' - menores primeiro (assumindo metadata.duration)
        query = query.order('name'); // Fallback para nome
    }

    query = query.limit(Math.min(limit, availableSlots * 3)); // Buscar mais para filtrar

    const { data: pendingVODs, error: pendingError } = await query;

    if (pendingError) {
      throw new Error(`Erro ao buscar VODs: ${pendingError.message}`);
    }

    if (!pendingVODs || pendingVODs.length === 0) {
      console.log('✅ [ScheduleVOD] Nenhum VOD pendente');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhum VOD pendente',
          scheduled: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Filtrar VODs com muitas falhas
    const vodIds = pendingVODs.map(v => v.id);
    
    const { data: failedDownloads } = await supabaseService
      .from('vod_downloads')
      .select('channel_id, retry_count')
      .in('channel_id', vodIds)
      .eq('status', 'failed')
      .gte('retry_count', 3);

    const blockedIds = new Set(failedDownloads?.map(f => f.channel_id) || []);

    const eligibleVODs = pendingVODs
      .filter(v => !blockedIds.has(v.id))
      .slice(0, availableSlots);

    if (eligibleVODs.length === 0) {
      console.log('⚠️ [ScheduleVOD] Todos VODs pendentes têm muitas falhas');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'VODs pendentes com muitas tentativas falhadas',
          scheduled: 0,
          blocked: blockedIds.size
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 [ScheduleVOD] ${eligibleVODs.length} VODs para processar`);

    // 4. Usar batch mode para processar múltiplos VODs de forma eficiente
    const channelIds = eligibleVODs.map(v => v.id);

    // Iniciar processamento em background
    EdgeRuntime.waitUntil(
      triggerBatchDownload(channelIds, supabaseService)
    );

    // 5. Limpar downloads antigos (em background)
    EdgeRuntime.waitUntil(
      (async () => {
        const { error } = await supabaseService.rpc('cleanup_old_vod_downloads');
        if (error) console.error('[ScheduleVOD] Cleanup error:', error);
      })()
    );

    console.log(`✅ [ScheduleVOD] ${channelIds.length} VODs agendados para download`);

    return new Response(
      JSON.stringify({
        success: true,
        scheduled: channelIds.length,
        activeDownloads: activeDownloads || 0,
        availableSlots,
        totalPending: pendingVODs.length,
        blocked: blockedIds.size,
        channelIds
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ [ScheduleVOD] Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Dispara download em batch via edge function
 */
async function triggerBatchDownload(
  channelIds: string[],
  _supabase: any
): Promise<void> {
  try {
    console.log(`🚀 [ScheduleVOD] Disparando batch de ${channelIds.length} downloads`);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const cronSecret = Deno.env.get('CRON_SECRET');
    
    const response = await fetch(`${supabaseUrl}/functions/v1/download-vod`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': cronSecret || '',
      },
      body: JSON.stringify({ 
        batch: true,
        channelIds 
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [ScheduleVOD] Erro no batch: ${response.status} - ${errorText}`);
    } else {
      console.log(`✅ [ScheduleVOD] Batch iniciado com sucesso`);
    }
  } catch (err) {
    console.error(`❌ [ScheduleVOD] Falha ao disparar batch:`, err);
    
    // Fallback: invocar individualmente
    console.log(`⚠️ [ScheduleVOD] Tentando downloads individuais...`);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const cronSecret = Deno.env.get('CRON_SECRET');
    
    for (const channelId of channelIds.slice(0, 5)) { // Limitar fallback
      try {
        await fetch(`${supabaseUrl}/functions/v1/download-vod`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': cronSecret || '',
          },
          body: JSON.stringify({ channelId })
        });
      } catch {
        console.error(`❌ [ScheduleVOD] Falha individual: ${channelId}`);
      }
    }
  }
}
