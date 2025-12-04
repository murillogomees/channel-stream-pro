import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface CleanStats {
  totalEntries: number;
  validEntries: number;
  duplicatesRemoved: number;
  invalidUrlsRemoved: number;
  emptyTitlesRemoved: number;
  processingTimeMs: number;
  quarantined: Array<{ title: string; url: string; reason: string }>;
}

// Validate URL format
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:', 'rtmp:', 'rtsp:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const url = new URL(req.url);
    const sourceId = url.searchParams.get('sourceId');
    const applyChanges = url.searchParams.get('apply') === 'true';

    if (!sourceId) {
      return new Response(
        JSON.stringify({ error: 'sourceId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[clean-sync-entries] Processing source: ${sourceId}, apply: ${applyChanges}`);

    // Get source info
    const { data: source, error: sourceError } = await supabase
      .from('m3u_sync_sources')
      .select('id, key, name, entries_count')
      .eq('id', sourceId)
      .single();

    if (sourceError || !source) {
      return new Response(
        JSON.stringify({ error: 'Source not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch entries in batches
    const BATCH_SIZE = 5000;
    let offset = 0;
    const allEntries: Array<{
      id: string;
      title: string;
      stream_url: string;
      group_title: string;
    }> = [];

    while (true) {
      const { data: batch, error: batchError } = await supabase
        .from('m3u_sync_entries')
        .select('id, title, stream_url, group_title')
        .eq('source_id', sourceId)
        .range(offset, offset + BATCH_SIZE - 1);

      if (batchError) {
        console.error('Batch fetch error:', batchError);
        break;
      }

      if (!batch || batch.length === 0) break;

      allEntries.push(...batch);
      offset += BATCH_SIZE;

      if (batch.length < BATCH_SIZE) break;
    }

    console.log(`[clean-sync-entries] Loaded ${allEntries.length} entries`);

    // Clean entries
    const stats: CleanStats = {
      totalEntries: allEntries.length,
      validEntries: 0,
      duplicatesRemoved: 0,
      invalidUrlsRemoved: 0,
      emptyTitlesRemoved: 0,
      processingTimeMs: 0,
      quarantined: [],
    };

    const seenUrls = new Set<string>();
    const validEntries: typeof allEntries = [];
    const toDelete: string[] = [];

    for (const entry of allEntries) {
      // Check empty title
      if (!entry.title || entry.title.trim() === '') {
        stats.emptyTitlesRemoved++;
        toDelete.push(entry.id);
        if (stats.quarantined.length < 100) {
          stats.quarantined.push({
            title: entry.title || '(empty)',
            url: entry.stream_url?.substring(0, 50) || '',
            reason: 'empty-title',
          });
        }
        continue;
      }

      // Check valid URL
      if (!isValidUrl(entry.stream_url)) {
        stats.invalidUrlsRemoved++;
        toDelete.push(entry.id);
        if (stats.quarantined.length < 100) {
          stats.quarantined.push({
            title: entry.title,
            url: entry.stream_url?.substring(0, 50) || '',
            reason: 'invalid-url',
          });
        }
        continue;
      }

      // Check duplicates
      if (seenUrls.has(entry.stream_url)) {
        stats.duplicatesRemoved++;
        toDelete.push(entry.id);
        if (stats.quarantined.length < 100) {
          stats.quarantined.push({
            title: entry.title,
            url: entry.stream_url?.substring(0, 50) || '',
            reason: 'duplicate',
          });
        }
        continue;
      }

      seenUrls.add(entry.stream_url);
      validEntries.push(entry);
    }

    stats.validEntries = validEntries.length;

    // Apply changes if requested
    if (applyChanges && toDelete.length > 0) {
      console.log(`[clean-sync-entries] Deleting ${toDelete.length} invalid entries`);
      
      // Delete in batches
      const DELETE_BATCH = 500;
      for (let i = 0; i < toDelete.length; i += DELETE_BATCH) {
        const batch = toDelete.slice(i, i + DELETE_BATCH);
        const { error: deleteError } = await supabase
          .from('m3u_sync_entries')
          .delete()
          .in('id', batch);

        if (deleteError) {
          console.error('Delete batch error:', deleteError);
        }
      }

      // Update source entries count
      await supabase
        .from('m3u_sync_sources')
        .update({
          entries_count: stats.validEntries,
          invalid_entries_count: 0,
          last_sync_at: new Date().toISOString(),
        })
        .eq('id', sourceId);
    }

    stats.processingTimeMs = Date.now() - startTime;

    console.log(`[clean-sync-entries] Complete: ${stats.validEntries} valid, ${toDelete.length} to remove`);

    return new Response(JSON.stringify({
      source: {
        id: source.id,
        key: source.key,
        name: source.name,
      },
      stats,
      applied: applyChanges,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[clean-sync-entries] Error:', message);

    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
