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

const DB_BATCH_SIZE = 100;
const CHANNELS_PER_EXECUTION = 15000; // Process fewer channels per execution to avoid memory issues
const MAX_CHANNELS = 300000;
const UPDATE_INTERVAL = 500;

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
      JSON.stringify({ success: true, sessionId: payload.sessionId }),
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
    const resumeFrom = payload.resumeFromChannel || 0;
    
    // Get session data for resume
    const { data: sessionData } = await supabase
      .from('m3u_import_sessions')
      .select('processed_channels, total_channels, metadata')
      .eq('id', payload.sessionId)
      .single();
    
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
    
    // Process using streaming
    if (payload.sourceType === 'url' && payload.sourceUrl) {
      await processFromUrl(payload, supabase, categoryMap, catOrder, resumeFrom, sessionData?.total_channels || 0);
    } else if (payload.sourceContent) {
      await processFromContent(payload.sourceContent, payload, supabase, categoryMap, catOrder, resumeFrom);
    } else {
      throw new Error('No content provided');
    }
    
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

async function processFromUrl(
  payload: ImportPayload, 
  supabase: any, 
  categoryMap: Map<string, string>,
  catOrder: number,
  resumeFrom: number,
  knownTotalChannels: number
) {
  const downloadUrl = convertGoogleDriveUrl(payload.sourceUrl!);
  console.log('[ProcessM3U] Streaming from:', downloadUrl);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300000);
  
  try {
    const response = await fetch(downloadUrl, { 
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*' },
      redirect: 'follow',
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const contentType = response.headers.get('content-type') || '';
    
    // Handle Google Drive HTML response
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
          
          // Process the retry response with streaming
          await processStreamResponse(retryResponse, payload, supabase, categoryMap, catOrder, resumeFrom, knownTotalChannels);
          return;
        } else {
          throw new Error('Google Drive: use "Colar Conteúdo" ao invés de URL');
        }
      } else {
        throw new Error('Link retornou HTML. Verifique se está correto e público.');
      }
    }
    
    await processStreamResponse(response, payload, supabase, categoryMap, catOrder, resumeFrom, knownTotalChannels);
    
  } catch (e: any) {
    clearTimeout(timeoutId);
    throw new Error(e.name === 'AbortError' ? 'Timeout: download demorou demais' : `Fetch: ${e.message}`);
  }
}

async function processStreamResponse(
  response: Response,
  payload: ImportPayload,
  supabase: any,
  categoryMap: Map<string, string>,
  catOrder: number,
  resumeFrom: number,
  knownTotalChannels: number
) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No body');
  
  const decoder = new TextDecoder();
  let buffer = '';
  let totalChannels = knownTotalChannels;
  let channelIndex = 0;
  let insertedCount = resumeFrom;
  let channelsThisExecution = 0;
  let batch: any[] = [];
  let channel: any = null;
  let foundM3U = false;
  
  console.log(`[ProcessM3U] Starting stream processing, resuming from ${resumeFrom}`);
  
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
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (value) {
        buffer += decoder.decode(value, { stream: true });
      }
      
      // Process complete lines
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;
        
        // Validate M3U header
        if (!foundM3U) {
          if (trimmedLine.includes('#EXTM3U')) {
            foundM3U = true;
            continue;
          } else if (trimmedLine.startsWith('#EXTINF:')) {
            foundM3U = true;
          }
        }
        
        if (trimmedLine.startsWith('#EXTINF:')) {
          channelIndex++;
          
          // Skip until resume point
          if (channelIndex <= resumeFrom) {
            continue;
          }
          
          // Check if we've processed enough channels this execution
          if (channelsThisExecution >= CHANNELS_PER_EXECUTION) {
            // Flush batch
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
                total_channels: totalChannels > 0 ? totalChannels : insertedCount + 50000,
                status: 'processing',
                metadata: { 
                  resumeFromChannel: insertedCount, 
                  categoryMap: categoryMapObj, 
                  catOrder, 
                  needsContinuation: true 
                }
              })
              .eq('id', payload.sessionId);
            
            console.log(`[ProcessM3U] Chunk done: ${insertedCount} processed, needs continuation`);
            reader.cancel().catch(() => {});
            return;
          }
          
          const g = trimmedLine.match(/group-title="([^"]*)"/);
          const n = trimmedLine.match(/,([^,]+)$/);
          const tid = trimmedLine.match(/tvg-id="([^"]*)"/);
          const tn = trimmedLine.match(/tvg-name="([^"]*)"/);
          const tl = trimmedLine.match(/tvg-logo="([^"]*)"/);
          
          channel = {
            group: g?.[1] || 'Sem Categoria',
            name: n?.[1]?.trim() || 'Canal',
            tvgId: tid?.[1] || null,
            tvgName: tn?.[1] || null,
            tvgLogo: tl?.[1] || null,
          };
        } else if (!trimmedLine.startsWith('#') && channel && channelIndex > resumeFrom) {
          const catId = await getCatId(channel.group);
          
          batch.push({
            category_id: catId,
            name: channel.name,
            stream_url: trimmedLine,
            tvg_id: channel.tvgId,
            tvg_name: channel.tvgName,
            tvg_logo: channel.tvgLogo,
            group_title: channel.group,
            order_position: insertedCount,
          });
          
          insertedCount++;
          channelsThisExecution++;
          channel = null;
          
          if (batch.length >= DB_BATCH_SIZE) {
            await supabase.from('m3u_channels').insert(batch);
            batch = [];
            
            if (insertedCount % UPDATE_INTERVAL === 0) {
              await supabase
                .from('m3u_import_sessions')
                .update({ 
                  processed_channels: insertedCount,
                  total_channels: totalChannels > 0 ? totalChannels : Math.max(insertedCount + 10000, channelIndex)
                })
                .eq('id', payload.sessionId);
              console.log(`[ProcessM3U] Progress: ${insertedCount} channels`);
            }
          }
          
          if (insertedCount >= MAX_CHANNELS) {
            console.log('[ProcessM3U] Max channels reached');
            break;
          }
        }
      }
      
      if (done) break;
    }
    
    // Process remaining buffer
    if (buffer.trim()) {
      const trimmedLine = buffer.trim();
      if (!trimmedLine.startsWith('#') && channel && channelIndex > resumeFrom) {
        const catId = await getCatId(channel.group);
        batch.push({
          category_id: catId,
          name: channel.name,
          stream_url: trimmedLine,
          tvg_id: channel.tvgId,
          tvg_name: channel.tvgName,
          tvg_logo: channel.tvgLogo,
          group_title: channel.group,
          order_position: insertedCount,
        });
        insertedCount++;
      }
    }
    
    // Insert remaining batch
    if (batch.length > 0) {
      await supabase.from('m3u_channels').insert(batch);
    }
    
    // Complete the import
    await supabase
      .from('m3u_import_sessions')
      .update({ 
        status: 'completed',
        processed_channels: insertedCount,
        total_channels: insertedCount,
        completed_at: new Date().toISOString(),
        error_message: null,
        metadata: { totalCategories: categoryMap.size }
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
    
  } finally {
    reader.cancel().catch(() => {});
  }
}

async function processFromContent(
  content: string,
  payload: ImportPayload,
  supabase: any,
  categoryMap: Map<string, string>,
  catOrder: number,
  resumeFrom: number
) {
  if (!content.includes('#EXTM3U') && !content.includes('#EXTINF:')) {
    throw new Error('Conteúdo não parece ser M3U válido');
  }
  
  const lines = content.split(/\r?\n/);
  let totalChannels = 0;
  
  // Count total on first run
  if (resumeFrom === 0) {
    for (const line of lines) {
      if (line.trim().startsWith('#EXTINF:')) totalChannels++;
    }
    totalChannels = Math.min(totalChannels, MAX_CHANNELS);
    
    await supabase
      .from('m3u_import_sessions')
      .update({ total_channels: totalChannels })
      .eq('id', payload.sessionId);
    
    console.log(`[ProcessM3U] Total channels from paste: ${totalChannels}`);
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
  let insertedCount = resumeFrom;
  let channelIndex = 0;
  let channelsThisExecution = 0;
  
  for (let i = 0; i < lines.length && insertedCount < MAX_CHANNELS; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    if (line.startsWith('#EXTINF:')) {
      channelIndex++;
      
      if (channelIndex <= resumeFrom) continue;
      
      if (channelsThisExecution >= CHANNELS_PER_EXECUTION) {
        if (batch.length > 0) {
          await supabase.from('m3u_channels').insert(batch);
          batch = [];
        }
        
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
        
        console.log(`[ProcessM3U] Paste chunk done: ${insertedCount}, needs continuation`);
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
    } else if (!line.startsWith('#') && channel && channelIndex > resumeFrom) {
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
      channelsThisExecution++;
      channel = null;

      if (batch.length >= DB_BATCH_SIZE) {
        await supabase.from('m3u_channels').insert(batch);
        batch = [];

        if (insertedCount % UPDATE_INTERVAL === 0) {
          await supabase
            .from('m3u_import_sessions')
            .update({ processed_channels: insertedCount })
            .eq('id', payload.sessionId);
          console.log(`[ProcessM3U] Paste progress: ${insertedCount}/${totalChannels}`);
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
      metadata: { totalCategories: categoryMap.size }
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

  console.log(`[ProcessM3U] Paste completed: ${insertedCount} channels, ${categoryMap.size} categories`);
}
