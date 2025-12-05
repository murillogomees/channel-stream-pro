/**
 * IPTV EPG Endpoint
 * 
 * Returns EPG data for a channel.
 * Endpoint: /api/iptv/epg?channelId=XXX
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const channelId = url.searchParams.get('channelId');
    const date = url.searchParams.get('date'); // Optional: specific date
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);

    if (!channelId) {
      return new Response(
        JSON.stringify({ error: 'channelId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Get channel to find tvg_id
    const { data: channel } = await supabase
      .from('m3u_channels')
      .select('tvg_id, tvg_name, name')
      .eq('id', channelId)
      .single();

    const epgChannelId = channel?.tvg_id || channel?.tvg_name || channel?.name || channelId;

    // Query EPG data
    const now = new Date();
    const startOfDay = date 
      ? new Date(date) 
      : new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    // Try to get from epg_programs table if exists
    const { data: programs, error: epgError } = await supabase
      .from('epg_programs')
      .select('*')
      .eq('channel_id', epgChannelId)
      .gte('end_time', now.toISOString())
      .lte('start_time', endOfDay.toISOString())
      .order('start_time')
      .limit(limit);

    if (epgError) {
      // Table might not exist, return mock/placeholder data
      console.log('[iptv-epg] EPG table error, returning placeholder');
      
      return new Response(
        JSON.stringify({
          channelId: epgChannelId,
          programs: [],
          message: 'EPG data not available for this channel',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format response
    const formattedPrograms = programs?.map(p => ({
      id: p.id,
      channelId: p.channel_id,
      title: p.title,
      description: p.description,
      start: p.start_time,
      end: p.end_time,
      category: p.category,
      icon: p.icon_url,
    })) || [];

    // Find current program
    const currentProgram = formattedPrograms.find(p => {
      const start = new Date(p.start).getTime();
      const end = new Date(p.end).getTime();
      const nowTime = now.getTime();
      return start <= nowTime && end > nowTime;
    });

    console.log(`[iptv-epg] Returned ${formattedPrograms.length} programs for channel ${channelId}`);

    return new Response(
      JSON.stringify({
        channelId: epgChannelId,
        programs: formattedPrograms,
        current: currentProgram || null,
        upcoming: formattedPrograms.filter(p => 
          new Date(p.start).getTime() > now.getTime()
        ).slice(0, 5),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[iptv-epg] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
