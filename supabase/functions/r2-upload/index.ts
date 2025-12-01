/**
 * R2 Upload Service
 * 
 * Uploads content to Cloudflare R2 with:
 * - Naming convention: iptvlink/{env}/{content_type}/{id}
 * - Automatic content-type detection
 * - Checksum verification
 * - CDN URL generation
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "npm:@aws-sdk/client-s3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize R2 client
function getR2Client() {
  const accountId = Deno.env.get('R2_ACCOUNT_ID') || Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID')!;
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')!;
  
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  });
}

// Generate R2 key following naming convention
function generateR2Key(env: string, contentType: string, id: string, extension?: string): string {
  const key = `iptvlink/${env}/${contentType}/${id}`;
  return extension ? `${key}.${extension}` : key;
}

// Detect MIME type from extension
function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    'm3u8': 'application/vnd.apple.mpegurl',
    'ts': 'video/mp2t',
    'mp4': 'video/mp4',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'webp': 'image/webp',
    'vtt': 'text/vtt',
    'srt': 'text/plain'
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}

// Get cache control based on content type
function getCacheControl(contentType: string): string {
  switch (contentType) {
    case 'manifest':
      return 'public, max-age=30, stale-while-revalidate=60';
    case 'segment':
      return 'public, max-age=86400';
    case 'thumbnail':
      return 'public, max-age=604800'; // 7 days
    case 'vod':
      return 'public, max-age=86400';
    default:
      return 'public, max-age=3600';
  }
}

// Calculate MD5 checksum
async function calculateMD5(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('MD5', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const r2Bucket = Deno.env.get('R2_BUCKET_NAME') || 'iptvlink-cdn';
  const r2Domain = Deno.env.get('R2_PUBLIC_DOMAIN') || 'cdn.example.com';
  const env = Deno.env.get('ENVIRONMENT') || 'prod';
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const r2Client = getR2Client();

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'upload';

    if (action === 'upload') {
      // Upload content to R2
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const sourceUrl = formData.get('source_url') as string | null;
      const contentType = formData.get('content_type') as string || 'vod';
      const channelId = formData.get('channel_id') as string | null;
      const customId = formData.get('id') as string || crypto.randomUUID();
      const extension = formData.get('extension') as string | null;

      let fileData: Uint8Array;
      let filename: string;

      if (file) {
        // Direct file upload
        fileData = new Uint8Array(await file.arrayBuffer());
        filename = file.name;
      } else if (sourceUrl) {
        // Fetch from URL
        console.log('[R2-Upload] Fetching from URL:', sourceUrl);
        const response = await fetch(sourceUrl, {
          headers: { 'User-Agent': 'R2-Upload-Bot/1.0' }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch source: ${response.status}`);
        }
        
        fileData = new Uint8Array(await response.arrayBuffer());
        filename = sourceUrl.split('/').pop() || 'file';
      } else {
        return new Response(
          JSON.stringify({ error: 'Either file or source_url is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate R2 key
      const ext = extension || filename.split('.').pop();
      const r2Key = generateR2Key(env, contentType, customId, ext);
      const mimeType = getMimeType(filename);
      const cacheControl = getCacheControl(contentType);
      const checksum = await calculateMD5(fileData);

      // Upload to R2
      console.log('[R2-Upload] Uploading to R2:', { r2Key, size: fileData.length, mimeType });
      
      await r2Client.send(new PutObjectCommand({
        Bucket: r2Bucket,
        Key: r2Key,
        Body: fileData,
        ContentType: mimeType,
        CacheControl: cacheControl,
        ContentEncoding: 'identity', // Brotli applied by CDN
        Metadata: {
          'channel-id': channelId || '',
          'upload-time': new Date().toISOString()
        }
      }));

      // Generate proper public CDN URL
      const cdnUrl = `https://${r2Domain}/${r2Key}`;
      console.log('[R2-Upload] Generated CDN URL:', cdnUrl);

      // Store in database
      const { data: record, error: dbError } = await supabase
        .from('r2_storage_objects')
        .upsert({
          r2_key: r2Key,
          r2_bucket: r2Bucket,
          content_type: contentType,
          mime_type: mimeType,
          size_bytes: fileData.length,
          checksum_md5: checksum,
          source_channel_id: channelId,
          source_url: sourceUrl,
          cdn_url: cdnUrl,
          cache_control: cacheControl,
          status: 'ready',
          updated_at: new Date().toISOString()
        }, { onConflict: 'r2_key' })
        .select()
        .single();

      if (dbError) {
        console.error('[R2-Upload] DB error:', dbError);
      }

      console.log('[R2-Upload] Upload complete:', r2Key);

      return new Response(
        JSON.stringify({
          success: true,
          r2_key: r2Key,
          cdn_url: cdnUrl,
          size_bytes: fileData.length,
          checksum: checksum,
          cache_control: cacheControl,
          record_id: record?.id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'delete') {
      // Delete from R2
      const body = await req.json();
      const { r2_key } = body;

      if (!r2_key) {
        return new Response(
          JSON.stringify({ error: 'r2_key is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await r2Client.send(new DeleteObjectCommand({
        Bucket: r2Bucket,
        Key: r2_key
      }));

      // Update database
      await supabase
        .from('r2_storage_objects')
        .update({ status: 'deleted' })
        .eq('r2_key', r2_key);

      return new Response(
        JSON.stringify({ success: true, deleted: r2_key }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'check') {
      // Check if object exists
      const r2Key = url.searchParams.get('r2_key');

      if (!r2Key) {
        return new Response(
          JSON.stringify({ error: 'r2_key is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        const head = await r2Client.send(new HeadObjectCommand({
          Bucket: r2Bucket,
          Key: r2Key
        }));

        return new Response(
          JSON.stringify({
            exists: true,
            size_bytes: head.ContentLength,
            content_type: head.ContentType,
            last_modified: head.LastModified?.toISOString()
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch {
        return new Response(
          JSON.stringify({ exists: false }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

    } else if (action === 'stats') {
      // Get CDN stats
      const { data: stats, error } = await supabase.rpc('get_cdn_stats');
      
      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, stats: stats?.[0] || {} }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[R2-Upload] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
