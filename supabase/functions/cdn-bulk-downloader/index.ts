import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DownloadOptions {
  maxChannels?: number;
  contentType?: 'all' | 'vod' | 'live';
  categories?: string[];
  onlyNew?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const options: DownloadOptions = await req.json();
    const { 
      maxChannels = 100, 
      contentType = 'all',
      categories = [],
      onlyNew = true 
    } = options;

    console.log(`[Bulk Download] Starting with options:`, { maxChannels, contentType, categories: categories.length, onlyNew });

    // Construir query base
    let query = supabase
      .from('m3u_channels')
      .select('id, name, group_title, stream_url, content_type, is_vod');

    // Filtro: apenas novos (não baixados)
    if (onlyNew) {
      query = query.is('cf_stream_uid', null);
    }

    // Filtro: tipo de conteúdo
    if (contentType === 'vod') {
      query = query.eq('is_vod', true);
    } else if (contentType === 'live') {
      query = query.eq('is_vod', false);
    }

    // Filtro: categorias
    if (categories && categories.length > 0) {
      query = query.in('group_title', categories);
    }

    // Limite
    query = query.limit(maxChannels);

    const { data: channels, error: channelsError } = await query;

    if (channelsError) throw channelsError;

    console.log(`[Bulk Download] Found ${channels?.length || 0} channels to process`);

    if (!channels || channels.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhum canal encontrado com os filtros selecionados',
          channelsCount: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Registrar job no banco
    const jobId = crypto.randomUUID();
    await supabase.from('cdn_prewarm_jobs').insert({
      id: jobId,
      job_type: 'bulk_download',
      status: 'running',
      total_assets: channels.length,
      prewarmed_assets: 0,
      target_r2_keys: [],
      metadata: { contentType, categories, onlyNew }
    });

    // Processar canais em background
    const processChannels = async () => {
      let completed = 0;
      let failed = 0;
      const r2Keys: string[] = [];

      for (const channel of channels) {
        try {
          const isLive = channel.stream_url?.includes('/live/') || 
                        channel.group_title?.toLowerCase().includes('ao vivo') ||
                        channel.content_type === 'live';

          // Invocar downloader individual
          const { data, error } = await supabase.functions.invoke('cdn-content-downloader', {
            body: {
              job: {
                channelId: channel.id,
                sourceUrl: channel.stream_url,
                contentType: isLive ? 'live' : 'vod',
                credentials: extractCredentials(channel.stream_url)
              }
            }
          });

          if (error) {
            console.error(`[Bulk] Failed for channel ${channel.id}:`, error);
            failed++;
          } else {
            console.log(`[Bulk] Success: ${channel.name}`);
            completed++;
            if (data?.r2Key) r2Keys.push(data.r2Key);
          }

          // Atualizar progresso
          await supabase.from('cdn_prewarm_jobs').update({
            prewarmed_assets: completed,
            failed_assets: failed,
            target_r2_keys: r2Keys
          }).eq('id', jobId);

        } catch (error: any) {
          console.error(`[Bulk] Error processing ${channel.id}:`, error.message);
          failed++;
        }
      }

      // Finalizar job
      await supabase.from('cdn_prewarm_jobs').update({
        status: failed === channels.length ? 'failed' : 'completed',
        completed_at: new Date().toISOString(),
        prewarmed_assets: completed,
        failed_assets: failed,
        target_r2_keys: r2Keys
      }).eq('id', jobId);

      console.log(`[Bulk Download] Completed: ${completed} success, ${failed} failed`);
    };

    // Executar em background usando EdgeRuntime.waitUntil
    (globalThis as any).EdgeRuntime?.waitUntil?.(processChannels()) || processChannels();

    return new Response(
      JSON.stringify({
        success: true,
        message: `Download iniciado para ${channels.length} canais`,
        channelsCount: channels.length,
        jobId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Bulk Download] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

function extractCredentials(url: string): { username?: string; password?: string } | undefined {
  try {
    const urlObj = new URL(url);
    if (urlObj.username || urlObj.password) {
      return {
        username: urlObj.username || undefined,
        password: urlObj.password || undefined
      };
    }
  } catch {
    // URL inválida
  }
  return undefined;
}
