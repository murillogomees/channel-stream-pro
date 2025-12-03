/**
 * Generate M3U File
 * 
 * Generates M3U playlist and uploads to R2 CDN using shared config helper.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  uploadToR2, 
  checkR2Config,
  R2_BUCKET_NAME,
  R2_CDN_BASE_URL
} from "../_shared/r2-config.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Security: Require admin authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Autenticação necessária' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create authenticated Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido ou expirado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role
    const { data: isAdmin, error: roleError } = await supabase.rpc('is_admin', { uid: user.id });
    if (roleError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Acesso negado - privilégios de administrador necessários' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { customListId } = await req.json();

    if (!customListId) {
      return new Response(
        JSON.stringify({ error: 'customListId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check R2 config
    const configStatus = checkR2Config();
    let cdnConfigured = configStatus.configured;

    // Use service role for database operations
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const startTime = Date.now();

    // Buscar lista personalizada
    const { data: customList, error: listError } = await supabaseService
      .from('m3u_custom_lists')
      .select('*')
      .eq('id', customListId)
      .single();

    if (listError || !customList) {
      throw new Error(`Lista não encontrada: ${listError?.message}`);
    }

    // Buscar categorias
    const { data: categories } = await supabaseService
      .from('m3u_categories')
      .select('*')
      .eq('custom_list_id', customListId)
      .order('order_position', { ascending: true });

    if (!categories || categories.length === 0) {
      throw new Error('Lista sem categorias configuradas');
    }

    // Gerar conteúdo M3U
    let m3uContent = '#EXTM3U\n\n';
    let totalChannels = 0;
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';

    for (const category of categories) {
      const { data: channels } = await supabaseService
        .from('m3u_channels')
        .select('*')
        .eq('category_id', category.id)
        .order('order_position', { ascending: true });

      if (channels && channels.length > 0) {
        for (const channel of channels) {
          let streamUrl;
          
          // VOD logic: If VOD and uploaded to R2, use R2 URL directly
          if (channel.is_vod && channel.r2_uploaded && channel.r2_url) {
            streamUrl = channel.r2_url;
          } else {
            // Live stream or VOD not downloaded: use proxy
            const encodedStreamUrl = encodeURIComponent(channel.stream_url);
            streamUrl = `${supabaseUrl}/functions/v1/stream-proxy?url=${encodedStreamUrl}&list=${customListId}`;
          }
          
          const tvgId = channel.tvg_id ? ` tvg-id="${channel.tvg_id}"` : '';
          const tvgName = channel.tvg_name ? ` tvg-name="${channel.tvg_name}"` : '';
          const tvgLogo = channel.tvg_logo ? ` tvg-logo="${channel.tvg_logo}"` : '';
          const groupTitle = ` group-title="${category.display_name}"`;

          m3uContent += `#EXTINF:-1${tvgId}${tvgName}${tvgLogo}${groupTitle},${channel.name}\n`;
          m3uContent += `${streamUrl}\n\n`;
          totalChannels++;
        }
      }
    }

    const generationTime = Date.now() - startTime;
    const fileSize = new TextEncoder().encode(m3uContent).length;

    // Upload to CDN (Cloudflare R2)
    let cdnUrl: string | null = null;
    let uploadTime = 0;
    let cdnUploadStatus = 'skipped';

    if (cdnConfigured) {
      try {
        const r2Key = `playlists/${customList.slug}.m3u`;
        const uploadResult = await uploadToR2({
          key: r2Key,
          body: m3uContent,
          contentType: 'audio/x-mpegurl',
          cacheControl: 'public, max-age=3600'
        });
        
        cdnUrl = uploadResult.cdnUrl;
        uploadTime = Date.now() - startTime - generationTime;
        cdnUploadStatus = 'success';
      } catch (uploadError: any) {
        console.error('⚠️ R2 upload failed, continuing without CDN:', uploadError.message);
        cdnUploadStatus = 'failed';
      }
    } else {
      console.log('⚠️ R2 not configured, skipping CDN upload. Missing:', configStatus.missing);
    }

    // Update list with CDN URL
    await supabaseService
      .from('m3u_custom_lists')
      .update({
        cdn_url: cdnUrl,
        bucket_path: cdnUrl ? `playlists/${customList.slug}.m3u` : null,
        total_channels: totalChannels,
        total_categories: categories.length,
        last_generated_at: new Date().toISOString()
      })
      .eq('id', customListId);

    // Log generation
    await supabaseService
      .from('m3u_generation_logs')
      .insert({
        custom_list_id: customListId,
        file_size: fileSize,
        channels_count: totalChannels,
        generation_time_ms: generationTime,
        cdn_upload_status: cdnUploadStatus,
        cdn_upload_time_ms: uploadTime
      });

    console.log(`✅ M3U gerada: ${customList.name} (${totalChannels} canais, ${fileSize} bytes, CDN: ${cdnUploadStatus})`);

    return new Response(
      JSON.stringify({
        success: true,
        cdnUrl,
        cdnBaseUrl: R2_CDN_BASE_URL,
        bucket: R2_BUCKET_NAME,
        fileSize,
        channelsCount: totalChannels,
        generationTime,
        uploadTime,
        cdnStatus: cdnUploadStatus
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro ao gerar M3U:', error);

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
