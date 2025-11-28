import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImportPayload {
  sessionId: string;
  sourceType: 'url' | 'paste';
  sourceUrl?: string;
  sourceContent?: string;
  customListId: string;
  chunkIndex?: number; // For chunked processing
  totalChunks?: number;
}

// Maximum channels to process per chunk to avoid CPU timeout
const CHUNK_SIZE = 5000;
const DB_BATCH_SIZE = 500;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const payload: ImportPayload = await req.json();
    console.log('[ProcessM3U] Iniciando processamento:', payload.sessionId);

    // Update session status
    await supabase
      .from('m3u_import_sessions')
      .update({ status: 'processing' })
      .eq('id', payload.sessionId);

    // Get M3U content
    let content: string;
    
    if (payload.sourceType === 'url' && payload.sourceUrl) {
      console.log('[ProcessM3U] Baixando M3U da URL:', payload.sourceUrl);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout
      
      try {
        const response = await fetch(payload.sourceUrl, { 
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 IPTV-Link/1.0' }
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        content = await response.text();
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('Timeout ao baixar M3U - arquivo muito grande ou servidor lento');
        }
        throw fetchError;
      }
    } else if (payload.sourceContent) {
      content = payload.sourceContent;
    } else {
      throw new Error('Source URL or content required');
    }

    // Quick parse to get total count and categories
    const parseResult = quickParseM3U(content);
    const totalChannels = parseResult.channelCount;
    const categories = parseResult.categories;
    
    console.log(`[ProcessM3U] Encontrados ${totalChannels} canais em ${categories.length} categorias`);

    // Update session with total
    await supabase
      .from('m3u_import_sessions')
      .update({ 
        total_channels: totalChannels,
        metadata: { categoriesCount: categories.length }
      })
      .eq('id', payload.sessionId);

    // Create categories first
    const categoryMap = new Map<string, string>();
    for (let idx = 0; idx < categories.length; idx++) {
      const cat = categories[idx];
      const { data: category, error } = await supabase
        .from('m3u_categories')
        .insert({
          custom_list_id: payload.customListId,
          name: cat,
          display_name: cat,
          order_position: idx,
        })
        .select('id')
        .single();
      
      if (category) {
        categoryMap.set(cat, category.id);
      }
    }

    // Process channels in streaming fashion
    const lines = content.split('\n');
    let currentChannel: any = {};
    let processedCount = 0;
    let batch: any[] = [];
    const defaultCategoryId = categoryMap.values().next().value;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('#EXTINF:')) {
        const tvgIdMatch = line.match(/tvg-id="([^"]*)"/);
        const tvgNameMatch = line.match(/tvg-name="([^"]*)"/);
        const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/);
        const groupMatch = line.match(/group-title="([^"]*)"/);
        const nameMatch = line.match(/,(.+)$/);
        
        currentChannel = {
          tvgId: tvgIdMatch?.[1] || null,
          tvgName: tvgNameMatch?.[1] || null,
          tvgLogo: tvgLogoMatch?.[1] || null,
          groupTitle: groupMatch?.[1] || 'Sem Categoria',
          name: nameMatch?.[1]?.trim() || 'Canal Sem Nome',
        };
      } else if (line && !line.startsWith('#') && currentChannel.name) {
        // Found URL - create channel entry
        const categoryId = categoryMap.get(currentChannel.groupTitle) || defaultCategoryId;
        
        batch.push({
          category_id: categoryId,
          name: currentChannel.name,
          stream_url: line,
          tvg_id: currentChannel.tvgId,
          tvg_name: currentChannel.tvgName,
          tvg_logo: currentChannel.tvgLogo,
          group_title: currentChannel.groupTitle,
          order_position: processedCount,
        });
        
        processedCount++;
        currentChannel = {};

        // Insert batch when full
        if (batch.length >= DB_BATCH_SIZE) {
          const { error } = await supabase.from('m3u_channels').insert(batch);
          if (error) {
            console.error('[ProcessM3U] Batch insert error:', error.message);
          }
          batch = [];

          // Update progress every 2000 channels
          if (processedCount % 2000 === 0) {
            await supabase
              .from('m3u_import_sessions')
              .update({ 
                processed_channels: processedCount,
                current_batch: Math.floor(processedCount / DB_BATCH_SIZE),
              })
              .eq('id', payload.sessionId);
            
            console.log(`[ProcessM3U] Progresso: ${processedCount}/${totalChannels}`);
          }
        }
      }
    }

    // Insert remaining channels
    if (batch.length > 0) {
      await supabase.from('m3u_channels').insert(batch);
    }

    // Complete session
    await supabase
      .from('m3u_import_sessions')
      .update({ 
        status: 'completed',
        processed_channels: processedCount,
        total_channels: processedCount,
        completed_at: new Date().toISOString(),
      })
      .eq('id', payload.sessionId);

    // Update custom list totals
    await supabase
      .from('m3u_custom_lists')
      .update({
        total_channels: processedCount,
        total_categories: categories.length,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payload.customListId);

    console.log(`[ProcessM3U] ✅ Concluído: ${processedCount} canais importados`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        channelsProcessed: processedCount,
        categoriesProcessed: categories.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[ProcessM3U] Erro:', error.message);
    
    // Update session as failed
    try {
      const body = await req.clone().json();
      await supabase
        .from('m3u_import_sessions')
        .update({ 
          status: 'failed',
          error_message: error.message,
          completed_at: new Date().toISOString(),
        })
        .eq('id', body.sessionId);
    } catch {}

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Quick parse to count channels and extract unique categories
 * More memory efficient than full parse
 */
function quickParseM3U(content: string): { channelCount: number; categories: string[] } {
  const categorySet = new Set<string>();
  let channelCount = 0;
  let inExtinf = false;
  
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('#EXTINF:')) {
      inExtinf = true;
      const groupMatch = trimmed.match(/group-title="([^"]*)"/);
      if (groupMatch) {
        categorySet.add(groupMatch[1]);
      } else {
        categorySet.add('Sem Categoria');
      }
    } else if (inExtinf && trimmed && !trimmed.startsWith('#')) {
      channelCount++;
      inExtinf = false;
    }
  }
  
  return {
    channelCount,
    categories: Array.from(categorySet),
  };
}
