import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface CleanConfig {
  preset: string;
  remove_empty_lines: boolean;
  keep_protocols: string[];
  dedupe_by: 'url' | 'title' | 'both' | 'none';
  strip_emojis: boolean;
  title_cleanup: Array<{ type: string; pattern: string; replace: string }>;
  group_actions: Array<{ group: string; action: 'keep' | 'remove' }>;
  healthcheck: {
    enabled: boolean;
    method: string;
    timeout: number;
    concurrency: number;
  };
  batchSize: number;
}

interface AnalysisResult {
  sampleSize: number;
  duplicateUrls: number;
  duplicateTitles: number;
  emptyTitles: number;
  invalidUrls: number;
  emojiCount: number;
  groups: Record<string, number>;
  protocols: Record<string, number>;
}

interface PreviewEntry {
  original: { title: string; url: string; group?: string };
  cleaned: { title: string; url: string; group?: string } | null;
  action: 'keep' | 'remove' | 'modify';
  reason?: string;
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

// Strip emojis from text
function stripEmojis(text: string): string {
  return text.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();
}

// Check if text contains emojis
function hasEmojis(text: string): boolean {
  return /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu.test(text);
}

// Get protocol from URL
function getProtocol(url: string): string {
  try {
    return new URL(url).protocol.replace(':', '');
  } catch {
    return 'invalid';
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    const { action, sourceId, config, sampleSize = 5000, previewSize = 100 } = body;

    if (!sourceId) {
      return new Response(
        JSON.stringify({ error: 'sourceId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[m3u-clean-advanced] Action: ${action}, Source: ${sourceId}`);

    // ANALYZE action - analyze a sample of entries and return suggestions
    if (action === 'analyze') {
      const { data: entries, error: fetchError } = await supabase
        .from('m3u_sync_entries')
        .select('id, title, stream_url, group_title')
        .eq('source_id', sourceId)
        .limit(sampleSize);

      if (fetchError) {
        throw new Error(`Failed to fetch entries: ${fetchError.message}`);
      }

      const analysis: AnalysisResult = {
        sampleSize: entries?.length || 0,
        duplicateUrls: 0,
        duplicateTitles: 0,
        emptyTitles: 0,
        invalidUrls: 0,
        emojiCount: 0,
        groups: {},
        protocols: {},
      };

      const seenUrls = new Set<string>();
      const seenTitles = new Set<string>();

      for (const entry of entries || []) {
        // Check duplicates
        if (entry.stream_url) {
          if (seenUrls.has(entry.stream_url)) {
            analysis.duplicateUrls++;
          }
          seenUrls.add(entry.stream_url);
        }

        if (entry.title) {
          if (seenTitles.has(entry.title)) {
            analysis.duplicateTitles++;
          }
          seenTitles.add(entry.title);
        }

        // Check empty titles
        if (!entry.title || entry.title.trim() === '') {
          analysis.emptyTitles++;
        }

        // Check invalid URLs
        if (!isValidUrl(entry.stream_url || '')) {
          analysis.invalidUrls++;
        }

        // Check emojis
        if (entry.title && hasEmojis(entry.title)) {
          analysis.emojiCount++;
        }

        // Count groups
        const group = entry.group_title || 'Sem Grupo';
        analysis.groups[group] = (analysis.groups[group] || 0) + 1;

        // Count protocols
        const protocol = getProtocol(entry.stream_url || '');
        analysis.protocols[protocol] = (analysis.protocols[protocol] || 0) + 1;
      }

      return new Response(JSON.stringify({ analysis }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PREVIEW action - show what would be cleaned
    if (action === 'preview') {
      const cleanConfig = config as CleanConfig;
      
      const { data: entries, error: fetchError } = await supabase
        .from('m3u_sync_entries')
        .select('id, title, stream_url, group_title')
        .eq('source_id', sourceId)
        .limit(previewSize);

      if (fetchError) {
        throw new Error(`Failed to fetch entries: ${fetchError.message}`);
      }

      const preview: PreviewEntry[] = [];
      const seenUrls = new Set<string>();
      const seenTitles = new Set<string>();
      
      let validCount = 0;
      let duplicatesRemoved = 0;
      let invalidUrlsRemoved = 0;
      let emptyTitlesRemoved = 0;

      for (const entry of entries || []) {
        const original = {
          title: entry.title || '',
          url: entry.stream_url || '',
          group: entry.group_title || undefined,
        };

        let action: 'keep' | 'remove' | 'modify' = 'keep';
        let reason: string | undefined;
        let cleanedTitle = original.title;

        // Check empty title
        if (cleanConfig.remove_empty_lines && (!entry.title || entry.title.trim() === '')) {
          action = 'remove';
          reason = 'Título vazio';
          emptyTitlesRemoved++;
        }
        // Check valid URL
        else if (!isValidUrl(entry.stream_url || '')) {
          action = 'remove';
          reason = 'URL inválida';
          invalidUrlsRemoved++;
        }
        // Check protocol
        else if (cleanConfig.keep_protocols && cleanConfig.keep_protocols.length > 0) {
          const protocol = getProtocol(entry.stream_url || '');
          if (!cleanConfig.keep_protocols.includes(protocol)) {
            action = 'remove';
            reason = `Protocolo não permitido: ${protocol}`;
            invalidUrlsRemoved++;
          }
        }
        // Check duplicate URL
        else if (cleanConfig.dedupe_by === 'url' || cleanConfig.dedupe_by === 'both') {
          if (seenUrls.has(entry.stream_url || '')) {
            action = 'remove';
            reason = 'URL duplicada';
            duplicatesRemoved++;
          }
        }
        // Check duplicate title
        else if (cleanConfig.dedupe_by === 'title' || cleanConfig.dedupe_by === 'both') {
          if (seenTitles.has(entry.title || '')) {
            action = 'remove';
            reason = 'Título duplicado';
            duplicatesRemoved++;
          }
        }
        // Check group actions
        else if (cleanConfig.group_actions && cleanConfig.group_actions.length > 0) {
          const groupAction = cleanConfig.group_actions.find(g => g.group === entry.group_title);
          if (groupAction?.action === 'remove') {
            action = 'remove';
            reason = `Grupo removido: ${entry.group_title}`;
          }
        }

        // Apply title cleanup
        if (action === 'keep') {
          if (cleanConfig.strip_emojis && hasEmojis(entry.title || '')) {
            cleanedTitle = stripEmojis(entry.title || '');
            if (cleanedTitle !== original.title) {
              action = 'modify';
              reason = 'Emojis removidos';
            }
          }

          // Apply regex cleanup
          if (cleanConfig.title_cleanup) {
            for (const rule of cleanConfig.title_cleanup) {
              if (rule.type === 'regex') {
                try {
                  const regex = new RegExp(rule.pattern, 'gi');
                  const newTitle = cleanedTitle.replace(regex, rule.replace);
                  if (newTitle !== cleanedTitle) {
                    cleanedTitle = newTitle;
                    action = 'modify';
                    reason = reason ? `${reason}, regex aplicado` : 'Regex aplicado';
                  }
                } catch {
                  // Invalid regex, skip
                }
              }
            }
          }
        }

        seenUrls.add(entry.stream_url || '');
        seenTitles.add(entry.title || '');

        if (action === 'keep') {
          validCount++;
        }

        preview.push({
          original,
          cleaned: action === 'remove' ? null : { ...original, title: cleanedTitle },
          action,
          reason,
        });
      }

      const stats = {
        totalEntries: entries?.length || 0,
        validEntries: validCount,
        duplicatesRemoved,
        invalidUrlsRemoved,
        emptyTitlesRemoved,
        protocolFiltered: 0,
        groupFiltered: 0,
        healthCheckFailed: 0,
        processingTimeMs: 0,
      };

      return new Response(JSON.stringify({ preview, stats }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PRESETS action - return available presets
    if (action === 'presets') {
      const { data: presets } = await supabase
        .from('m3u_clean_presets')
        .select('*')
        .order('name');

      return new Response(JSON.stringify({ presets: presets || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use: analyze, preview, presets' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[m3u-clean-advanced] Error:', message);

    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
