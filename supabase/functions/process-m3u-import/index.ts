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
  resumeFromChannel?: number;
}

const DB_BATCH_SIZE = 200;
const CHUNK_SIZE = 35000; // Process 35k channels per invocation to stay under CPU limit
const MAX_CHANNELS = 300000;
const MAX_SIZE = 150 * 1024 * 1024;
const UPDATE_INTERVAL = 1000;

declare const EdgeRuntime: { waitUntil: (promise: Promise<any>) => void };

function convertGoogleDriveUrl(url: string): string {
  const viewMatch = url.match(/drive\.google\.com\/file\/d\/([^\/]+)/);
  if (viewMatch) {
    return `https://drive.google.com/uc?export=download&id=${viewMatch[1]}`;
  }
  const openMatch = url.match(/drive\.google\.com\/open\?id=([^&]+)/);
  if (openMatch) {
    return `https://drive.google.com/uc?export=download&id=${openMatch[1]}`;
  }
  return url;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: ImportPayload = await req.json();
    const isResume = (payload.resumeFromChannel || 0) > 0;
    console.log('[ProcessM3U] Starting:', payload.sessionId, isResume ? `(resuming from ${payload.resumeFromChannel})` : '(new)');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase
      .from('m3u_import_sessions')
      .update({ 
        status: 'processing',
        ...(!isResume && { processed_channels: 0 })
      })
      .eq('id', payload.sessionId);

    EdgeRuntime.waitUntil(processInBackground(payload, supabase));

    return new Response(
      JSON.stringify({ success: true, sessionId: payload.sessionId, chunkSize: CHUNK_SIZE }),
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
      const downloadUrl = convertGoogleDriveUrl(payload.sourceUrl);
      console.log('[ProcessM3U] Fetching:', downloadUrl);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000);
      
      try {
        const response = await fetch(downloadUrl, { 
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*' },
          redirect: 'follow',
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const contentType = response.headers.get('content-type') || '';
        
        if (contentType.includes('text/html')) {
          const htmlContent = await response.text();
          if (htmlContent.includes('confirm=') || htmlContent.includes('download_warning')) {
            const confirmMatch = htmlContent.match(/confirm=([^&"]+)/);
            if (confirmMatch) {
              const retryResponse = await fetch(`${downloadUrl}&confirm=${confirmMatch[1]}`, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                redirect: 'follow',
              });
              if (!retryResponse.ok) throw new Error('Google Drive inaccessible');
              content = await retryResponse.text();
            } else {
              throw new Error('Google Drive: use "Colar Conteúdo" ao invés de URL');
            }
          } else {
            throw new Error('Link retornou HTML. Verifique se está correto e público.');
          }
        } else {
          const reader = response.body?.getReader();
          if (!reader) throw new Error('No body');
          
          let totalSize = 0;
          const chunks: Uint8Array[] = [];
          
          while (totalSize < MAX_SIZE) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            totalSize += value.length;
          }
          reader.cancel().catch(() => {});
          
          const combined = new Uint8Array(totalSize);
          let offset = 0;
          for (const chunk of chunks) {
            combined.set(chunk, offset);
            offset += chunk.length;
          }
          content = new TextDecoder().decode(combined);
          console.log(`[ProcessM3U] Downloaded: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
        }
      } catch (e: any) {
        clearTimeout(timeoutId);
        throw new Error(e.name === 'AbortError' ? 'Timeout: download demorou demais' : `Fetch: ${e.message}`);
      }
    } else if (payload.sourceContent) {
      content = payload.sourceContent;
    } else {
      throw new Error('No content provided');
    }

    if (!content.includes('#EXTM3U') && !content.includes('#EXTINF:')) {
      throw new Error('Conteúdo não parece ser M3U válido');
    }

    await processContent(content, payload, supabase);
    
  } catch (error: any) {
    console.error('[ProcessM3U] Background error:', error.message);
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
  const lines = content.split(/\r?\n/);
  const resumeFrom = payload.resumeFromChannel || 0;
  
  const { data: sessionData } = await supabase
    .from('m3u_import_sessions')
    .select('processed_channels, total_channels, metadata')
    .eq('id', payload.sessionId)
    .single();
  
  let existingProcessed = resumeFrom > 0 ? resumeFrom : 0;
  let categoryMap = new Map<string, string>();
  let catOrder = 0;
  
  // Restore state if resuming
  if (resumeFrom > 0 && sessionData?.metadata?.categoryMap) {
    const savedMap = sessionData.metadata.categoryMap;
    for (const [key, value] of Object.entries(savedMap)) {
      categoryMap.set(key, value as string);
    }
    catOrder = sessionData.metadata.catOrder || 0;
    console.log(`[ProcessM3U] Resumed with ${categoryMap.size} categories from channel ${resumeFrom}`);
  }
  
  // Count total channels on first run
  let totalChannels = sessionData?.total_channels || 0;
  if (totalChannels === 0) {
    for (const line of lines) {
      if (line.trim().startsWith('#EXTINF:')) totalChannels++;
    }
    totalChannels = Math.min(totalChannels, MAX_CHANNELS);
    console.log(`[ProcessM3U] Total channels: ${totalChannels}`);
    
    await supabase
      .from('m3u_import_sessions')
      .update({ total_channels: totalChannels })
      .eq('id', payload.sessionId);
  }
  
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
  
  let batch: any[] = [];
  let channel: any = null;
  let channelsInChunk = 0;
  let insertedCount = existingProcessed;
  let channelIndex = 0;
  
  // Skip to resume point
  if (resumeFrom > 0) {
    let count = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('#EXTINF:')) {
        count++;
        if (count > resumeFrom) {
          channelIndex = i;
          break;
        }
      }
    }
    console.log(`[ProcessM3U] Skipping to channel ${resumeFrom}, line ${channelIndex}`);
  }
  
  for (let i = channelIndex; i < lines.length && insertedCount < MAX_CHANNELS; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    if (line.startsWith('#EXTINF:')) {
      // Check chunk limit
      if (channelsInChunk >= CHUNK_SIZE) {
        // Flush remaining batch
        if (batch.length > 0) {
          await supabase.from('m3u_channels').insert(batch);
          batch = [];
        }
        
        // Save state for continuation
        const categoryMapObj: Record<string, string> = {};
        categoryMap.forEach((v, k) => categoryMapObj[k] = v);
        
        await supabase
          .from('m3u_import_sessions')
          .update({ 
            processed_channels: insertedCount,
            status: 'processing',
            metadata: { resumeFromChannel: insertedCount, categoryMap: categoryMapObj, catOrder, needsContinuation: true }
          })
          .eq('id', payload.sessionId);
        
        console.log(`[ProcessM3U] Chunk done: ${insertedCount}/${totalChannels}. Needs continuation.`);
        return;
      }
      
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
        order_position: insertedCount,
      });
      
      insertedCount++;
      channelsInChunk++;
      channel = null;

      if (batch.length >= DB_BATCH_SIZE) {
        await supabase.from('m3u_channels').insert(batch);
        batch = [];

        if (insertedCount % UPDATE_INTERVAL === 0) {
          await supabase
            .from('m3u_import_sessions')
            .update({ processed_channels: insertedCount })
            .eq('id', payload.sessionId);
          console.log(`[ProcessM3U] Progress: ${insertedCount}/${totalChannels} (${((insertedCount/totalChannels)*100).toFixed(1)}%)`);
        }
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
      processed_channels: insertedCount,
      total_channels: insertedCount,
      completed_at: new Date().toISOString(),
      error_message: null,
      metadata: null
    })
    .eq('id', payload.sessionId);

  await supabase
    .from('m3u_custom_lists')
    .update({
      total_channels: insertedCount,
      total_categories: categoryMap.size,
      updated_at: new Date().toISOString(),
    })
    .eq('id', payload.customListId);

  console.log(`[ProcessM3U] Completed: ${insertedCount} channels, ${categoryMap.size} categories`);
}
