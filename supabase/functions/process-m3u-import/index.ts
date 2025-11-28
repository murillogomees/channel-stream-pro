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

const DB_BATCH_SIZE = 50;
const MAX_CHANNELS = 15000;
const MAX_SIZE = 5 * 1024 * 1024; // 5MB limit

declare const EdgeRuntime: { waitUntil: (promise: Promise<any>) => void };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: ImportPayload = await req.json();
    console.log('[ProcessM3U] Starting:', payload.sessionId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase
      .from('m3u_import_sessions')
      .update({ status: 'processing' })
      .eq('id', payload.sessionId);

    EdgeRuntime.waitUntil(processInBackground(payload, supabase));

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Processing started',
        sessionId: payload.sessionId,
        maxChannels: MAX_CHANNELS
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[ProcessM3U] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function processInBackground(payload: ImportPayload, supabase: any) {
  try {
    let content: string;
    
    if (payload.sourceType === 'url' && payload.sourceUrl) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);
      
      try {
        const response = await fetch(payload.sourceUrl, { 
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 IPTV-Link/1.0' }
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const reader = response.body?.getReader();
        if (!reader) throw new Error('No body');
        
        let totalSize = 0;
        const chunks: string[] = [];
        const decoder = new TextDecoder();
        
        while (totalSize < MAX_SIZE) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          chunks.push(text);
          totalSize += value.length;
        }
        
        reader.cancel().catch(() => {});
        content = chunks.join('');
        chunks.length = 0; // Free memory
        console.log(`[ProcessM3U] Downloaded: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
        
      } catch (e: any) {
        clearTimeout(timeoutId);
        throw new Error(`Fetch: ${e.message}`);
      }
    } else if (payload.sourceContent) {
      content = payload.sourceContent;
    } else {
      throw new Error('No content');
    }

    await processContent(content, payload, supabase);
    
  } catch (error: any) {
    console.error('[ProcessM3U] Error:', error.message);
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

async function processContent(content: string, payload: ImportPayload, supabase: any) {
  const categoryMap = new Map<string, string>();
  let catOrder = 0;
  let count = 0;
  let batch: any[] = [];
  
  async function getCatId(name: string): Promise<string> {
    const key = name || 'Sem Categoria';
    if (categoryMap.has(key)) return categoryMap.get(key)!;
    
    const { data } = await supabase
      .from('m3u_categories')
      .insert({
        custom_list_id: payload.customListId,
        name: key,
        display_name: key,
        order_position: catOrder++,
      })
      .select('id')
      .single();
    
    if (data) {
      categoryMap.set(key, data.id);
      return data.id;
    }
    return categoryMap.values().next().value || '';
  }

  let start = 0;
  let channel: any = null;
  const len = content.length;
  
  for (let i = 0; i <= len && count < MAX_CHANNELS; i++) {
    if (i === len || content[i] === '\n') {
      const line = content.slice(start, i).trim();
      start = i + 1;
      
      if (!line) continue;
      
      if (line.startsWith('#EXTINF:')) {
        const g = line.match(/group-title="([^"]*)"/);
        const n = line.match(/,([^,]+)$/);
        const tid = line.match(/tvg-id="([^"]*)"/);
        const tn = line.match(/tvg-name="([^"]*)"/);
        const tl = line.match(/tvg-logo="([^"]*)"/);
        
        channel = {
          group: g?.[1] || 'Sem Categoria',
          name: n?.[1]?.trim() || 'Canal',
          tvgId: tid?.[1] || null,
          tvgName: tn?.[1] || null,
          tvgLogo: tl?.[1] || null,
        };
      } else if (!line.startsWith('#') && channel) {
        const catId = await getCatId(channel.group);
        
        batch.push({
          category_id: catId,
          name: channel.name,
          stream_url: line,
          tvg_id: channel.tvgId,
          tvg_name: channel.tvgName,
          tvg_logo: channel.tvgLogo,
          group_title: channel.group,
          order_position: count,
        });
        
        count++;
        channel = null;

        if (batch.length >= DB_BATCH_SIZE) {
          await supabase.from('m3u_channels').insert(batch);
          batch = [];

          if (count % 500 === 0) {
            await supabase
              .from('m3u_import_sessions')
              .update({ processed_channels: count })
              .eq('id', payload.sessionId);
            console.log(`[ProcessM3U] Progress: ${count}`);
          }
        }
      }
    }
  }

  if (batch.length > 0) {
    await supabase.from('m3u_channels').insert(batch);
  }

  const limited = count >= MAX_CHANNELS;
  await supabase
    .from('m3u_import_sessions')
    .update({ 
      status: 'completed',
      processed_channels: count,
      total_channels: count,
      completed_at: new Date().toISOString(),
      error_message: limited ? `Limitado a ${MAX_CHANNELS} canais` : null,
    })
    .eq('id', payload.sessionId);

  await supabase
    .from('m3u_custom_lists')
    .update({
      total_channels: count,
      total_categories: categoryMap.size,
      updated_at: new Date().toISOString(),
    })
    .eq('id', payload.customListId);

  console.log(`[ProcessM3U] Done: ${count} channels, ${categoryMap.size} categories`);
}
