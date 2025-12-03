/**
 * R2 Upload Service
 * 
 * Uses shared R2 config helper for standardized operations.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  getR2Client, 
  getR2Config,
  checkR2Config,
  uploadToR2,
  deleteFromR2,
  objectExists,
  generateR2Key,
  getMimeType,
  getCdnUrl,
  R2_BUCKET_NAME,
  HeadObjectCommand
} from "../_shared/r2-config.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

  // Check R2 config first
  const configStatus = checkR2Config();
  if (!configStatus.configured) {
    return new Response(
      JSON.stringify({ 
        error: 'R2 not configured', 
        missing: configStatus.missing,
        bucket: R2_BUCKET_NAME 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const env = Deno.env.get('ENVIRONMENT') || 'production';
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

      // Generate R2 key using shared helper
      const ext = extension || filename.split('.').pop();
      const r2Key = generateR2Key(contentType as any, customId, ext);
      const mimeType = getMimeType(filename);
      const cacheControl = getCacheControl(contentType);
      const checksum = await calculateMD5(fileData);

      // Upload to R2 using shared helper
      console.log('[R2-Upload] Uploading to R2:', { r2Key, size: fileData.length, mimeType });
      
      const uploadResult = await uploadToR2({
        key: r2Key,
        body: fileData,
        contentType: mimeType,
        cacheControl,
        metadata: {
          'channel-id': channelId || '',
          'upload-time': new Date().toISOString()
        }
      });

      // Store in database
      const { data: record, error: dbError } = await supabase
        .from('r2_storage_objects')
        .upsert({
          r2_key: r2Key,
          r2_bucket: R2_BUCKET_NAME,
          content_type: contentType,
          mime_type: mimeType,
          size_bytes: fileData.length,
          checksum_md5: checksum,
          source_channel_id: channelId,
          source_url: sourceUrl,
          cdn_url: uploadResult.cdnUrl,
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
          cdn_url: uploadResult.cdnUrl,
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

      await deleteFromR2(r2_key);

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

      const exists = await objectExists(r2Key);
      
      if (exists) {
        const client = getR2Client();
        const config = getR2Config();
        const head = await client.send(new HeadObjectCommand({
          Bucket: config.bucketName,
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
      }

      return new Response(
        JSON.stringify({ exists: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

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
