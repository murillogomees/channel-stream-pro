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

    const { maxChannels = 50 } = await req.json();

    console.log(`[Bulk Download] Starting bulk download for max ${maxChannels} channels`);

    // Buscar canais que ainda não estão no R2
    const { data: channels, error: channelsError } = await supabase
      .from('m3u_channels')
      .select('id, name, group_title, stream_url, content_type, is_vod')
      .is('cf_stream_uid', null) // Canais que não estão no Cloudflare
      .limit(maxChannels);

    if (channelsError) throw channelsError;

    console.log(`[Bulk Download] Found ${channels?.length || 0} channels to process`);

    // Processar em background
    const downloadPromises = channels?.map(async (channel) => {
      try {
        // Determinar tipo de conteúdo
        const isLive = channel.stream_url?.includes('/live/') || 
                      channel.group_title?.toLowerCase().includes('ao vivo') ||
                      channel.content_type === 'live';

        // Invocar downloader
        const { error } = await supabase.functions.invoke('cdn-content-downloader', {
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
        } else {
          console.log(`[Bulk] Success for channel ${channel.id}: ${channel.name}`);
        }

      } catch (error: any) {
        console.error(`[Bulk] Error processing channel ${channel.id}:`, error.message);
      }
    }) || [];

    // Não esperar conclusão (background job)
    Promise.all(downloadPromises).then(() => {
      console.log('[Bulk Download] All downloads initiated');
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Iniciado download de ${channels?.length || 0} canais em background`,
        channelsCount: channels?.length || 0
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error('[Bulk Download] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

/**
 * Extrair credenciais da URL (formato: http://username:password@host/path)
 */
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
    // URL inválida, ignorar
  }
  return undefined;
}
