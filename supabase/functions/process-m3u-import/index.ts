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
}

// Smaller batch sizes to reduce memory
const DB_BATCH_SIZE = 200;

declare const EdgeRuntime: { waitUntil: (promise: Promise<any>) => void };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: ImportPayload = await req.json();
    console.log('[ProcessM3U] Iniciando:', payload.sessionId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update session status immediately
    await supabase
      .from('m3u_import_sessions')
      .update({ status: 'processing' })
      .eq('id', payload.sessionId);

    // Start background processing
    EdgeRuntime.waitUntil(processInBackground(payload, supabase));

    // Return immediately
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Processamento iniciado em segundo plano',
        sessionId: payload.sessionId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[ProcessM3U] Erro inicial:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function processInBackground(payload: ImportPayload, supabase: any) {
  try {
    console.log('[ProcessM3U-BG] Iniciando background:', payload.sessionId);
    
    // For URL sources, stream the content
    if (payload.sourceType === 'url' && payload.sourceUrl) {
      await processFromUrl(payload, supabase);
    } else if (payload.sourceContent) {
      await processFromContent(payload.sourceContent, payload, supabase);
    }
    
  } catch (error: any) {
    console.error('[ProcessM3U-BG] Erro:', error.message);
    await supabase
      .from('m3u_import_sessions')
      .update({ 
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString(),
      })
      .eq('id', payload.sessionId);
  }
}

async function processFromUrl(payload: ImportPayload, supabase: any) {
  console.log('[ProcessM3U-BG] Baixando:', payload.sourceUrl);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout
  
  try {
    const response = await fetch(payload.sourceUrl!, { 
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 IPTV-Link/1.0' }
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    // Read as text but process line by line efficiently
    const text = await response.text();
    await processFromContent(text, payload, supabase);
    
  } catch (fetchError: any) {
    clearTimeout(timeoutId);
    throw new Error(`Falha ao baixar: ${fetchError.message}`);
  }
}

async function processFromContent(content: string, payload: ImportPayload, supabase: any) {
  console.log('[ProcessM3U-BG] Processando conteúdo...');
  
  // First pass: extract categories (minimal memory)
  const categorySet = new Set<string>();
  let estimatedChannels = 0;
  
  let pos = 0;
  while (pos < content.length) {
    const lineEnd = content.indexOf('\n', pos);
    const line = lineEnd === -1 
      ? content.substring(pos).trim()
      : content.substring(pos, lineEnd).trim();
    
    if (line.startsWith('#EXTINF:')) {
      estimatedChannels++;
      const groupMatch = line.match(/group-title="([^"]*)"/);
      categorySet.add(groupMatch?.[1] || 'Sem Categoria');
    }
    
    if (lineEnd === -1) break;
    pos = lineEnd + 1;
  }
  
  const categories = Array.from(categorySet);
  console.log(`[ProcessM3U-BG] ${estimatedChannels} canais, ${categories.length} categorias`);

  // Update session with total estimate
  await supabase
    .from('m3u_import_sessions')
    .update({ 
      total_channels: estimatedChannels,
      metadata: { categoriesCount: categories.length }
    })
    .eq('id', payload.sessionId);

  // Create categories
  const categoryMap = new Map<string, string>();
  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    const { data } = await supabase
      .from('m3u_categories')
      .insert({
        custom_list_id: payload.customListId,
        name: cat,
        display_name: cat,
        order_position: i,
      })
      .select('id')
      .single();
    
    if (data) categoryMap.set(cat, data.id);
  }

  const defaultCategoryId = categoryMap.values().next().value;
  
  // Second pass: process channels in batches
  let batch: any[] = [];
  let processedCount = 0;
  let currentChannel: any = null;
  
  pos = 0;
  while (pos < content.length) {
    const lineEnd = content.indexOf('\n', pos);
    const line = lineEnd === -1 
      ? content.substring(pos).trim()
      : content.substring(pos, lineEnd).trim();
    
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
    } else if (line && !line.startsWith('#') && currentChannel) {
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
      currentChannel = null;

      // Insert when batch is full
      if (batch.length >= DB_BATCH_SIZE) {
        await supabase.from('m3u_channels').insert(batch);
        batch = [];

        // Update progress periodically
        if (processedCount % 1000 === 0) {
          await supabase
            .from('m3u_import_sessions')
            .update({ processed_channels: processedCount })
            .eq('id', payload.sessionId);
          console.log(`[ProcessM3U-BG] Progresso: ${processedCount}/${estimatedChannels}`);
        }
      }
    }
    
    if (lineEnd === -1) break;
    pos = lineEnd + 1;
  }

  // Insert remaining
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

  // Update custom list
  await supabase
    .from('m3u_custom_lists')
    .update({
      total_channels: processedCount,
      total_categories: categories.length,
      updated_at: new Date().toISOString(),
    })
    .eq('id', payload.customListId);

  console.log(`[ProcessM3U-BG] ✅ Concluído: ${processedCount} canais`);
}
