import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const STORAGE_BUCKET = Deno.env.get('STORAGE_BUCKET') || 'playlists';
const ARCHIVE_DAY = parseInt(Deno.env.get('ARCHIVE_DAY') || '3');

// SHA256 using SubtleCrypto
async function sha256Hex(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Get previous month in YYYY-MM format
function getPreviousMonth(): string {
  const now = new Date();
  now.setMonth(now.getMonth() - 1);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// Simple tar header creation (512 bytes)
function createTarHeader(name: string, size: number): Uint8Array {
  const header = new Uint8Array(512);
  const encoder = new TextEncoder();
  
  // File name (100 bytes)
  const nameBytes = encoder.encode(name.substring(0, 99));
  header.set(nameBytes, 0);
  
  // File mode (8 bytes) - 0644
  header.set(encoder.encode('0000644\0'), 100);
  
  // Owner UID (8 bytes)
  header.set(encoder.encode('0000000\0'), 108);
  
  // Owner GID (8 bytes)
  header.set(encoder.encode('0000000\0'), 116);
  
  // File size in octal (12 bytes)
  const sizeOctal = size.toString(8).padStart(11, '0') + '\0';
  header.set(encoder.encode(sizeOctal), 124);
  
  // Modification time (12 bytes)
  const mtime = Math.floor(Date.now() / 1000).toString(8).padStart(11, '0') + '\0';
  header.set(encoder.encode(mtime), 136);
  
  // Checksum placeholder (8 spaces)
  header.set(encoder.encode('        '), 148);
  
  // Type flag - regular file
  header[156] = 48; // '0'
  
  // Calculate checksum
  let checksum = 0;
  for (let i = 0; i < 512; i++) {
    checksum += header[i];
  }
  const checksumStr = checksum.toString(8).padStart(6, '0') + '\0 ';
  header.set(encoder.encode(checksumStr), 148);
  
  return header;
}

// Pad to 512-byte boundary
function padTo512(size: number): Uint8Array {
  const remainder = size % 512;
  if (remainder === 0) return new Uint8Array(0);
  return new Uint8Array(512 - remainder);
}

// Simple gzip using CompressionStream
async function gzipCompress(data: Uint8Array): Promise<Uint8Array> {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
  
  const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
  const reader = compressedStream.getReader();
  const chunks: Uint8Array[] = [];
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  
  // Concatenate chunks
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  
  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  const startTime = Date.now();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  try {
    // Check if we should run (day of month)
    const today = new Date().getDate();
    const forceRun = new URL(req.url).searchParams.get('force') === 'true';
    
    if (today !== ARCHIVE_DAY && !forceRun) {
      return new Response(JSON.stringify({
        message: `Archive job runs on day ${ARCHIVE_DAY}. Today is day ${today}. Use ?force=true to override.`,
        skipped: true,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const targetMonth = getPreviousMonth();
    console.log(`Starting archive for month: ${targetMonth}`);
    
    // Check if already archived
    const { data: existingArchive } = await supabase
      .from('archives')
      .select('id')
      .eq('month', targetMonth)
      .single();
    
    if (existingArchive) {
      return new Response(JSON.stringify({
        message: `Archive for ${targetMonth} already exists`,
        archiveId: existingArchive.id,
        skipped: true,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Get playlists for archival
    const { data: playlists, error: queryError } = await supabase
      .rpc('get_playlists_for_archival', { target_month: targetMonth.replace('-', '/') });
    
    if (queryError) throw queryError;
    
    if (!playlists || playlists.length === 0) {
      return new Response(JSON.stringify({
        message: `No playlists to archive for ${targetMonth}`,
        count: 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log(`Found ${playlists.length} playlists to archive`);
    
    // Build tar archive in memory
    const tarParts: Uint8Array[] = [];
    const playlistIds: string[] = [];
    let totalOriginalSize = 0;
    
    for (const playlist of playlists) {
      // Download file from storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .download(playlist.storage_path);
      
      if (downloadError) {
        console.error(`Failed to download ${playlist.storage_path}: ${downloadError.message}`);
        continue;
      }
      
      const content = new Uint8Array(await fileData.arrayBuffer());
      totalOriginalSize += content.length;
      
      // Create tar entry
      const header = createTarHeader(playlist.storage_path, content.length);
      tarParts.push(header);
      tarParts.push(content);
      tarParts.push(padTo512(content.length));
      
      playlistIds.push(playlist.id);
    }
    
    // Add tar end marker (two 512-byte zero blocks)
    tarParts.push(new Uint8Array(1024));
    
    // Concatenate tar parts
    const totalTarSize = tarParts.reduce((sum, part) => sum + part.length, 0);
    const tarData = new Uint8Array(totalTarSize);
    let offset = 0;
    for (const part of tarParts) {
      tarData.set(part, offset);
      offset += part.length;
    }
    
    // Compress with gzip
    console.log(`Compressing ${totalTarSize} bytes...`);
    const gzippedData = await gzipCompress(tarData);
    const archiveSha256 = await sha256Hex(gzippedData);
    
    console.log(`Compressed to ${gzippedData.length} bytes (${((gzippedData.length / totalTarSize) * 100).toFixed(1)}%)`);
    
    // Upload archive
    const archivePath = `archive/${targetMonth}.tar.gz`;
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(archivePath, gzippedData, {
        contentType: 'application/gzip',
        cacheControl: 'public, max-age=31536000',
        upsert: true,
      });
    
    if (uploadError) {
      throw new Error(`Failed to upload archive: ${uploadError.message}`);
    }
    
    // Create archive record
    const { data: archiveRecord, error: insertError } = await supabase
      .from('archives')
      .insert({
        path: archivePath,
        month: targetMonth,
        size_bytes: gzippedData.length,
        sha256: archiveSha256,
        playlist_count: playlistIds.length,
        verified_at: new Date().toISOString(),
        metadata: {
          original_size: totalOriginalSize,
          compression_ratio: (gzippedData.length / totalTarSize).toFixed(3),
          processing_time_ms: Date.now() - startTime,
        },
      })
      .select()
      .single();
    
    if (insertError) {
      // Cleanup uploaded archive
      await supabase.storage.from(STORAGE_BUCKET).remove([archivePath]);
      throw new Error(`Failed to create archive record: ${insertError.message}`);
    }
    
    // Mark playlists as archived
    const { data: markedCount, error: markError } = await supabase
      .rpc('mark_playlists_archived', {
        playlist_ids: playlistIds,
        p_archive_id: archiveRecord.id,
      });
    
    if (markError) {
      console.error(`Failed to mark playlists: ${markError.message}`);
    }
    
    // Delete original files from storage
    const pathsToDelete = playlists.map((p: any) => p.storage_path);
    const { error: deleteError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove(pathsToDelete);
    
    if (deleteError) {
      console.error(`Failed to delete original files: ${deleteError.message}`);
    }
    
    const result = {
      success: true,
      month: targetMonth,
      archiveId: archiveRecord.id,
      archivePath,
      sha256: archiveSha256,
      stats: {
        playlistCount: playlistIds.length,
        originalSize: totalOriginalSize,
        compressedSize: gzippedData.length,
        compressionRatio: (gzippedData.length / totalTarSize).toFixed(3),
        processingTimeMs: Date.now() - startTime,
      },
    };
    
    console.log('Archive completed:', JSON.stringify(result));
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('archive-playlists error:', message);
    
    return new Response(
      JSON.stringify({ error: message, processingTimeMs: Date.now() - startTime }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
