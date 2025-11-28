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

const DB_BATCH_SIZE = 100;
const MAX_CHANNELS = 50000; // Limit to prevent memory issues

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

    // Update session status
    await supabase
      .from('m3u_import_sessions')
      .update({ status: 'processing' })
      .eq('id', payload.sessionId);

    // Start background processing
    EdgeRuntime.waitUntil(processInBackground(payload, supabase));

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Processamento iniciado',
        sessionId: payload.sessionId,
        maxChannels: MAX_CHANNELS
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
    console.log('[ProcessM3U-BG] Iniciando:', payload.sessionId);
    
    if (payload.sourceType === 'url' && payload.sourceUrl) {
      await processFromUrlStreaming(payload, supabase);
    } else if (payload.sourceContent) {
      // For pasted content, process directly (usually smaller)
      await processSmallContent(payload.sourceContent, payload, supabase);
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

async function processFromUrlStreaming(payload: ImportPayload, supabase: any) {
  console.log('[ProcessM3U-BG] Streaming:', payload.sourceUrl);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 min timeout
  
  try {
    const response = await fetch(payload.sourceUrl!, { 
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 IPTV-Link/1.0' }
    });
    clearTimeout(timeoutId);
    
    if (!response.ok || !response.body) {
      throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    const categorySet = new Set<string>();
    let currentChannel: any = null;
    let lineBuffer = '';
    let processedCount = 0;
    let batch: any[] = [];
    
    // First pass: Read entire stream to get categories (lightweight)
    let fullContent = '';
    let totalSize = 0;
    const MAX_SIZE = 30 * 1024 * 1024; // 30MB limit
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      totalSize += chunk.length;
      
      if (totalSize > MAX_SIZE) {
        console.log('[ProcessM3U-BG] Arquivo muito grande, limitando...');
        fullContent += chunk;
        break;
      }
      
      fullContent += chunk;
      
      // Extract categories as we go
      const groupMatches = chunk.matchAll(/group-title="([^"]*)"/g);
      for (const match of groupMatches) {
        categorySet.add(match[1] || 'Sem Categoria');
      }
    }
    
    console.log(`[ProcessM3U-BG] Baixado: ${(totalSize / 1024 / 1024).toFixed(2)}MB, ${categorySet.size} categorias`);
    
    // Create categories
    const categories = Array.from(categorySet);
    const categoryMap = new Map<string, string>();
    
    for (let i = 0; i < categories.length; i++) {
      const { data } = await supabase
        .from('m3u_categories')
        .insert({
          custom_list_id: payload.customListId,
          name: categories[i],
          display_name: categories[i],
          order_position: i,
        })
        .select('id')
        .single();
      
      if (data) categoryMap.set(categories[i], data.id);
    }
    
    const defaultCategoryId = categoryMap.values().next().value;
    
    // Second pass: Process channels line by line
    const lines = fullContent.split('\n');
    fullContent = ''; // Free memory
    
    for (let i = 0; i < lines.length && processedCount < MAX_CHANNELS; i++) {
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

        if (batch.length >= DB_BATCH_SIZE) {
          await supabase.from('m3u_channels').insert(batch);
          batch = [];

          if (processedCount % 500 === 0) {
            await supabase
              .from('m3u_import_sessions')
              .update({ processed_channels: processedCount })
              .eq('id', payload.sessionId);
            console.log(`[ProcessM3U-BG] Progresso: ${processedCount}`);
          }
        }
      }
    }

    // Insert remaining
    if (batch.length > 0) {
      await supabase.from('m3u_channels').insert(batch);
    }

    // Complete
    const wasLimited = processedCount >= MAX_CHANNELS;
    await supabase
      .from('m3u_import_sessions')
      .update({ 
        status: 'completed',
        processed_channels: processedCount,
        total_channels: processedCount,
        completed_at: new Date().toISOString(),
        error_message: wasLimited ? `Limitado a ${MAX_CHANNELS} canais` : null,
      })
      .eq('id', payload.sessionId);

    await supabase
      .from('m3u_custom_lists')
      .update({
        total_channels: processedCount,
        total_categories: categories.length,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payload.customListId);

    console.log(`[ProcessM3U-BG] ✅ Concluído: ${processedCount} canais, ${categories.length} categorias`);
    
  } catch (fetchError: any) {
    clearTimeout(timeoutId);
    throw new Error(`Falha: ${fetchError.message}`);
  }
}

async function processSmallContent(content: string, payload: ImportPayload, supabase: any) {
  // For pasted content (usually small)
  const categorySet = new Set<string>();
  const lines = content.split('\n');
  
  // Extract categories
  for (const line of lines) {
    if (line.startsWith('#EXTINF:')) {
      const groupMatch = line.match(/group-title="([^"]*)"/);
      categorySet.add(groupMatch?.[1] || 'Sem Categoria');
    }
  }
  
  const categories = Array.from(categorySet);
  const categoryMap = new Map<string, string>();
  
  for (let i = 0; i < categories.length; i++) {
    const { data } = await supabase
      .from('m3u_categories')
      .insert({
        custom_list_id: payload.customListId,
        name: categories[i],
        display_name: categories[i],
        order_position: i,
      })
      .select('id')
      .single();
    
    if (data) categoryMap.set(categories[i], data.id);
  }
  
  const defaultCategoryId = categoryMap.values().next().value;
  let currentChannel: any = null;
  let processedCount = 0;
  let batch: any[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('#EXTINF:')) {
      const tvgIdMatch = trimmed.match(/tvg-id="([^"]*)"/);
      const tvgNameMatch = trimmed.match(/tvg-name="([^"]*)"/);
      const tvgLogoMatch = trimmed.match(/tvg-logo="([^"]*)"/);
      const groupMatch = trimmed.match(/group-title="([^"]*)"/);
      const nameMatch = trimmed.match(/,(.+)$/);
      
      currentChannel = {
        tvgId: tvgIdMatch?.[1] || null,
        tvgName: tvgNameMatch?.[1] || null,
        tvgLogo: tvgLogoMatch?.[1] || null,
        groupTitle: groupMatch?.[1] || 'Sem Categoria',
        name: nameMatch?.[1]?.trim() || 'Canal Sem Nome',
      };
    } else if (trimmed && !trimmed.startsWith('#') && currentChannel) {
      batch.push({
        category_id: categoryMap.get(currentChannel.groupTitle) || defaultCategoryId,
        name: currentChannel.name,
        stream_url: trimmed,
        tvg_id: currentChannel.tvgId,
        tvg_name: currentChannel.tvgName,
        tvg_logo: currentChannel.tvgLogo,
        group_title: currentChannel.groupTitle,
        order_position: processedCount,
      });
      
      processedCount++;
      currentChannel = null;

      if (batch.length >= DB_BATCH_SIZE) {
        await supabase.from('m3u_channels').insert(batch);
        batch = [];
      }
    }
  }

  if (batch.length > 0) {
    await supabase.from('m3u_channels').insert(batch);
  }

  await supabase
    .from('m3u_import_sessions')
    .update({ 
      status: 'completed',
      processed_channels: processedCount,
      total_channels: processedCount,
      completed_at: new Date().toISOString(),
    })
    .eq('id', payload.sessionId);

  await supabase
    .from('m3u_custom_lists')
    .update({
      total_channels: processedCount,
      total_categories: categories.length,
    })
    .eq('id', payload.customListId);

  console.log(`[ProcessM3U-BG] ✅ Concluído (paste): ${processedCount} canais`);
}
