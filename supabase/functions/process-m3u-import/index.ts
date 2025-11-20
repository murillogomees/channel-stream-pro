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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload: ImportPayload = await req.json();
    console.log('[ProcessM3U] Iniciando processamento:', payload.sessionId);

    // Atualizar status da sessão para processing
    await supabase
      .from('m3u_import_sessions')
      .update({ status: 'processing' })
      .eq('id', payload.sessionId);

    // Obter conteúdo M3U
    let content: string;
    let sourceHash: string;

    if (payload.sourceType === 'url' && payload.sourceUrl) {
      // Verificar cache primeiro
      sourceHash = await generateHash(payload.sourceUrl);
      
      const { data: cached } = await supabase
        .from('m3u_import_cache')
        .select('*')
        .eq('source_hash', sourceHash)
        .maybeSingle();

      if (cached) {
        console.log('[ProcessM3U] Cache hit! Usando dados cacheados');
        await applyCachedData(supabase, payload.customListId, cached);
        await completeSession(supabase, payload.sessionId, cached.channel_count);
        return new Response(JSON.stringify({ success: true, cached: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Baixar conteúdo
      console.log('[ProcessM3U] Baixando M3U da URL:', payload.sourceUrl);
      const response = await fetch(payload.sourceUrl);
      content = await response.text();
    } else if (payload.sourceContent) {
      content = payload.sourceContent;
      sourceHash = await generateHash(content);
    } else {
      throw new Error('Source URL or content required');
    }

    // Processar M3U linha por linha (streaming)
    const result = await processM3UStreaming(content);
    
    // Salvar categorias
    const categoryMap = new Map<string, string>();
    for (const [idx, cat] of result.categories.entries()) {
      const { data: category } = await supabase
        .from('m3u_categories')
        .insert({
          custom_list_id: payload.customListId,
          name: cat.name,
          display_name: cat.displayName,
          order_position: idx,
        })
        .select()
        .single();
      
      if (category) {
        categoryMap.set(cat.name, category.id);
      }
    }

    // Processar canais em batches
    const BATCH_SIZE = 1000;
    let processedCount = 0;

    for (let i = 0; i < result.channels.length; i += BATCH_SIZE) {
      const batch = result.channels.slice(i, i + BATCH_SIZE);
      const channelsToInsert = batch.map(ch => ({
        category_id: categoryMap.get(ch.groupTitle) || categoryMap.values().next().value,
        name: ch.name,
        stream_url: ch.url,
        tvg_id: ch.tvgId,
        tvg_name: ch.tvgName,
        tvg_logo: ch.tvgLogo,
        group_title: ch.groupTitle,
        order_position: i + batch.indexOf(ch),
      }));

      await supabase.from('m3u_channels').insert(channelsToInsert);
      
      processedCount += batch.length;
      
      // Atualizar progresso
      await supabase
        .from('m3u_import_sessions')
        .update({ 
          processed_channels: processedCount,
          current_batch: Math.floor(i / BATCH_SIZE) + 1,
        })
        .eq('id', payload.sessionId);
    }

    // Salvar no cache
    await supabase.from('m3u_import_cache').insert({
      source_hash: sourceHash,
      source_url: payload.sourceUrl || null,
      channel_count: result.channels.length,
      categories_data: result.categories,
      channels_data: result.channels,
    });

    // Completar sessão
    await completeSession(supabase, payload.sessionId, result.channels.length);

    return new Response(
      JSON.stringify({ 
        success: true, 
        channelsProcessed: result.channels.length,
        categoriesProcessed: result.categories.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[ProcessM3U] Erro:', error);
    
    // Atualizar sessão como failed
    try {
      const payload: ImportPayload = await req.json();
      await createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )
        .from('m3u_import_sessions')
        .update({ 
          status: 'failed',
          error_message: error.message,
        })
        .eq('id', payload.sessionId);
    } catch {}

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function generateHash(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

interface M3UChannel {
  name: string;
  url: string;
  tvgId: string | null;
  tvgName: string | null;
  tvgLogo: string | null;
  groupTitle: string;
}

interface M3UCategory {
  name: string;
  displayName: string;
}

interface ParseResult {
  channels: M3UChannel[];
  categories: M3UCategory[];
}

function processM3UStreaming(content: string): ParseResult {
  const lines = content.split('\n');
  const channels: M3UChannel[] = [];
  const categorySet = new Set<string>();
  
  let currentChannel: Partial<M3UChannel> = {};
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('#EXTINF:')) {
      // Parse channel info
      const tvgIdMatch = trimmed.match(/tvg-id="([^"]*)"/);
      const tvgNameMatch = trimmed.match(/tvg-name="([^"]*)"/);
      const tvgLogoMatch = trimmed.match(/tvg-logo="([^"]*)"/);
      const groupMatch = trimmed.match(/group-title="([^"]*)"/);
      const nameMatch = trimmed.match(/,(.+)$/);
      
      currentChannel = {
        tvgId: tvgIdMatch ? tvgIdMatch[1] : null,
        tvgName: tvgNameMatch ? tvgNameMatch[1] : null,
        tvgLogo: tvgLogoMatch ? tvgLogoMatch[1] : null,
        groupTitle: groupMatch ? groupMatch[1] : 'Sem Categoria',
        name: nameMatch ? nameMatch[1].trim() : 'Canal Sem Nome',
      };
      
      if (currentChannel.groupTitle) {
        categorySet.add(currentChannel.groupTitle);
      }
    } else if (trimmed && !trimmed.startsWith('#') && currentChannel.name) {
      // URL do canal
      currentChannel.url = trimmed;
      channels.push(currentChannel as M3UChannel);
      currentChannel = {};
    }
  }
  
  const categories: M3UCategory[] = Array.from(categorySet).map(name => ({
    name,
    displayName: name,
  }));
  
  return { channels, categories };
}

async function applyCachedData(supabase: any, customListId: string, cached: any) {
  // Criar categorias
  const categoryMap = new Map<string, string>();
  for (const [idx, cat] of cached.categories_data.entries()) {
    const { data: category } = await supabase
      .from('m3u_categories')
      .insert({
        custom_list_id: customListId,
        name: cat.name,
        display_name: cat.displayName,
        order_position: idx,
      })
      .select()
      .single();
    
    if (category) {
      categoryMap.set(cat.name, category.id);
    }
  }

  // Criar canais
  const channelsToInsert = cached.channels_data.map((ch: any, idx: number) => ({
    category_id: categoryMap.get(ch.groupTitle) || categoryMap.values().next().value,
    name: ch.name,
    stream_url: ch.url,
    tvg_id: ch.tvgId,
    tvg_name: ch.tvgName,
    tvg_logo: ch.tvgLogo,
    group_title: ch.groupTitle,
    order_position: idx,
  }));

  await supabase.from('m3u_channels').insert(channelsToInsert);
  
  // Atualizar use_count do cache
  await supabase
    .from('m3u_import_cache')
    .update({ 
      use_count: cached.use_count + 1,
      last_used_at: new Date().toISOString(),
    })
    .eq('id', cached.id);
}

async function completeSession(supabase: any, sessionId: string, totalChannels: number) {
  await supabase
    .from('m3u_import_sessions')
    .update({ 
      status: 'completed',
      total_channels: totalChannels,
      processed_channels: totalChannels,
      completed_at: new Date().toISOString(),
    })
    .eq('id', sessionId);
}