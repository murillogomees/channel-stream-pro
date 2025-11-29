import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-cron-secret',
};

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar autenticação
    const cronSecret = req.headers.get('x-supabase-cron-secret');
    const authHeader = req.headers.get('authorization');
    const expectedSecret = Deno.env.get('CRON_SECRET');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

    const isCronRequest = cronSecret === expectedSecret;
    const isServiceRoleRequest = authHeader?.includes(serviceRoleKey || '');
    const isPgCronRequest = authHeader?.includes(anonKey || '') && 
                           req.headers.get('user-agent')?.includes('pg_net');
    let isAdminRequest = false;

    if (!isCronRequest && !isServiceRoleRequest && !isPgCronRequest && authHeader) {
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

    if (!isCronRequest && !isServiceRoleRequest && !isPgCronRequest && !isAdminRequest) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json().catch(() => ({}));
    const { limit = 3 } = body;

    console.log(`🕐 [ScheduleVOD] Iniciando - limit: ${limit}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Sincronizar VODs detectados das entradas CDN para m3u_channels
    console.log(`🔄 [ScheduleVOD] Sincronizando VODs do CDN...`);
    
    // Buscar entradas CDN marcadas como VOD
    const { data: vodEntries } = await supabase
      .from('m3u_sync_entries')
      .select('stream_url, title, group_title, tvg_logo, tvg_name, tvg_id')
      .eq('is_vod', true)
      .eq('is_valid', true)
      .limit(1000);

    if (vodEntries && vodEntries.length > 0) {
      const vodUrls = vodEntries.map(v => v.stream_url);
      
      // Buscar ou criar categoria padrão para VODs do CDN
      let categoryId: string;
      const { data: existingCategory } = await supabase
        .from('m3u_categories')
        .select('id')
        .eq('name', 'VOD_CDN')
        .maybeSingle();
      
      if (existingCategory) {
        categoryId = existingCategory.id;
      } else {
        // Buscar uma custom_list ou criar uma
        const { data: existingList } = await supabase
          .from('m3u_custom_lists')
          .select('id')
          .limit(1)
          .maybeSingle();
        
        let listId: string;
        if (existingList) {
          listId = existingList.id;
        } else {
          const { data: newList } = await supabase
            .from('m3u_custom_lists')
            .insert({ name: 'VOD CDN', slug: 'vod-cdn', status: 'active' })
            .select('id')
            .single();
          listId = newList?.id || '';
        }
        
        const { data: newCategory } = await supabase
          .from('m3u_categories')
          .insert({ name: 'VOD_CDN', display_name: 'VODs do CDN', custom_list_id: listId })
          .select('id')
          .single();
        categoryId = newCategory?.id || '';
      }

      // Verificar quais URLs já existem em m3u_channels
      const { data: existingChannels } = await supabase
        .from('m3u_channels')
        .select('stream_url')
        .in('stream_url', vodUrls);

      const existingUrls = new Set(existingChannels?.map(c => c.stream_url) || []);
      
      // Criar novos canais para VODs que não existem
      const newChannels = vodEntries
        .filter(v => !existingUrls.has(v.stream_url))
        .map(v => ({
          name: v.title || 'VOD sem nome',
          stream_url: v.stream_url,
          group_title: v.group_title,
          tvg_logo: v.tvg_logo,
          tvg_name: v.tvg_name,
          tvg_id: v.tvg_id,
          category_id: categoryId,
          is_vod: true,
          content_type: 'vod',
          r2_uploaded: false
        }));

      if (newChannels.length > 0) {
        await supabase.from('m3u_channels').insert(newChannels);
        console.log(`✅ [ScheduleVOD] Criados ${newChannels.length} novos canais VOD`);
      }

      // Marcar canais existentes com mesma URL como VOD
      await supabase
        .from('m3u_channels')
        .update({ is_vod: true, content_type: 'vod' })
        .in('stream_url', vodUrls)
        .eq('is_vod', false);
    }

    // 2. Verificar downloads ativos
    const { count: activeCount } = await supabase
      .from('vod_downloads')
      .select('*', { count: 'exact', head: true })
      .in('status', ['downloading', 'processing', 'queued']);

    const MAX_CONCURRENT = 3;
    const availableSlots = Math.max(0, MAX_CONCURRENT - (activeCount || 0));

    if (availableSlots === 0) {
      console.log(`⏸️ [ScheduleVOD] Limite atingido (${activeCount}/${MAX_CONCURRENT})`);
      return new Response(JSON.stringify({ success: true, scheduled: 0, active: activeCount }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 3. Resetar downloads travados (>5 min sem atualização)
    const { data: stuckDownloads } = await supabase
      .from('vod_downloads')
      .select('id')
      .in('status', ['downloading', 'processing', 'queued'])
      .lt('updated_at', new Date(Date.now() - 5 * 60 * 1000).toISOString());

    if (stuckDownloads && stuckDownloads.length > 0) {
      console.log(`🔄 [ScheduleVOD] Resetando ${stuckDownloads.length} downloads travados`);
      await supabase
        .from('vod_downloads')
        .update({ status: 'failed', error_message: 'Timeout automático' })
        .in('id', stuckDownloads.map(d => d.id));
    }

    // 4. Retomar downloads pausados primeiro
    const { data: pausedDownloads } = await supabase
      .from('vod_downloads')
      .select('id')
      .eq('status', 'paused')
      .order('updated_at', { ascending: true })
      .limit(availableSlots);

    if (pausedDownloads && pausedDownloads.length > 0) {
      console.log(`🔄 [ScheduleVOD] Retomando ${pausedDownloads.length} downloads pausados`);
      EdgeRuntime.waitUntil(resumeDownloads(pausedDownloads.map(d => d.id)));
      
      return new Response(JSON.stringify({ 
        success: true, 
        resumed: pausedDownloads.length,
        active: activeCount 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 5. Buscar VODs pendentes (agora já inclui os sincronizados do CDN)
    const { data: pendingVODs, error: pendingError } = await supabase
      .from('m3u_channels')
      .select('id, name, stream_url')
      .eq('is_vod', true)
      .eq('r2_uploaded', false)
      .order('name')
      .limit(Math.min(limit, availableSlots * 2));

    if (pendingError || !pendingVODs || pendingVODs.length === 0) {
      console.log('✅ [ScheduleVOD] Nenhum VOD pendente');
      return new Response(JSON.stringify({ success: true, scheduled: 0, totalPending: 0 }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Contar total de pendentes
    const { count: totalPending } = await supabase
      .from('m3u_channels')
      .select('*', { count: 'exact', head: true })
      .eq('is_vod', true)
      .eq('r2_uploaded', false);

    // 6. Filtrar VODs já em download ou com muitas falhas
    const vodIds = pendingVODs.map(v => v.id);
    
    const { data: existingDownloads } = await supabase
      .from('vod_downloads')
      .select('channel_id, original_url, status, retry_count')
      .or(`channel_id.in.(${vodIds.join(',')}),status.in.(queued,downloading,processing,paused)`);

    const blockedChannels = new Set<string>();
    const blockedUrls = new Set<string>();
    
    existingDownloads?.forEach(d => {
      if (d.status && ['queued', 'downloading', 'processing', 'paused'].includes(d.status)) {
        blockedChannels.add(d.channel_id);
        if (d.original_url) blockedUrls.add(d.original_url);
      }
      if ((d.retry_count || 0) >= 3) {
        blockedChannels.add(d.channel_id);
      }
    });

    // Verificar URLs já no R2
    const vodUrls = pendingVODs.map(v => v.stream_url);
    const { data: uploadedSameUrl } = await supabase
      .from('m3u_channels')
      .select('stream_url')
      .in('stream_url', vodUrls)
      .eq('r2_uploaded', true);

    uploadedSameUrl?.forEach(c => blockedUrls.add(c.stream_url));

    // Filtrar elegíveis
    const seenUrls = new Set<string>();
    const eligible = pendingVODs.filter(v => {
      if (blockedChannels.has(v.id)) return false;
      if (blockedUrls.has(v.stream_url)) return false;
      if (seenUrls.has(v.stream_url)) return false;
      seenUrls.add(v.stream_url);
      return true;
    }).slice(0, availableSlots);

    if (eligible.length === 0) {
      console.log('⚠️ [ScheduleVOD] Nenhum VOD elegível');
      return new Response(JSON.stringify({ 
        success: true, 
        scheduled: 0, 
        blocked: blockedChannels.size,
        totalPending: totalPending || 0
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`📋 [ScheduleVOD] ${eligible.length} VODs para processar`);

    // 7. Iniciar downloads
    EdgeRuntime.waitUntil(triggerDownloads(eligible.map(v => v.id)));

    // 8. Limpar downloads antigos
    EdgeRuntime.waitUntil((async () => {
      try {
        await supabase.rpc('cleanup_old_vod_downloads');
      } catch (e) {
        console.log('Cleanup error (ignorado):', e);
      }
    })());

    return new Response(JSON.stringify({
      success: true,
      scheduled: eligible.length,
      active: activeCount,
      totalPending: totalPending || 0,
      channelIds: eligible.map(v => v.id)
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('❌ [ScheduleVOD] Erro:', error);
    return new Response(JSON.stringify({ error: error.message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

async function resumeDownloads(downloadIds: string[]): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const cronSecret = Deno.env.get('CRON_SECRET');
  
  for (const downloadId of downloadIds) {
    try {
      await fetch(`${supabaseUrl}/functions/v1/download-vod`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': cronSecret || ''
        },
        body: JSON.stringify({ resume: true, downloadId })
      });
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      console.error(`❌ Falha ao retomar ${downloadId}:`, err);
    }
  }
}

async function triggerDownloads(channelIds: string[]): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const cronSecret = Deno.env.get('CRON_SECRET');
  
  try {
    await fetch(`${supabaseUrl}/functions/v1/download-vod`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': cronSecret || ''
      },
      body: JSON.stringify({ batch: true, channelIds })
    });
  } catch (err) {
    console.error(`❌ Falha ao disparar downloads:`, err);
  }
}
