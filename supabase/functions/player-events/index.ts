/**
 * Player Events Edge Function
 * 
 * Receives player analytics events and stores them in Supabase
 * Endpoint: /api/player/events
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface PlayerEvent {
  event: string;
  contentId: string;
  contentType: string;
  sessionId: string;
  timestamp: number;
  data?: Record<string, any>;
}

interface EventPayload {
  sessionId: string;
  deviceType: string;
  events: PlayerEvent[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header (optional)
    let userId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    // Parse payload
    const payload: EventPayload = await req.json();
    const { sessionId, deviceType, events } = payload;

    if (!events || events.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No events to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Transform events for database
    const records = events.map(event => ({
      profile_id: userId,
      content_id: event.contentId,
      content_type: event.contentType,
      event_type: event.event,
      event_data: event.data || {},
      session_id: sessionId,
      device_type: deviceType,
      watch_hour: new Date(event.timestamp).getHours(),
      watch_day: new Date(event.timestamp).getDay(),
      created_at: new Date(event.timestamp).toISOString(),
    }));

    // Insert events
    const { error } = await supabase
      .from('player_analytics')
      .insert(records);

    if (error) {
      console.error('[player-events] Insert error:', error);
      throw error;
    }

    // Process special events for aggregation
    for (const event of events) {
      // Track first frame time for QoS metrics
      if (event.event === 'firstFrame' && event.data?.timeToFirstFrame) {
        await trackQoSMetric(supabase, event.contentId, 'time_to_first_frame', event.data.timeToFirstFrame);
      }

      // Track buffering events
      if (event.event === 'buffering' && event.data?.state === 'end' && event.data?.duration) {
        await trackQoSMetric(supabase, event.contentId, 'buffer_duration', event.data.duration);
      }

      // Track bitrate changes for quality metrics
      if (event.event === 'bitrateChange') {
        await trackQoSMetric(supabase, event.contentId, 'bitrate', event.data?.bitrate || 0);
      }
    }

    console.log(`[player-events] Processed ${events.length} events for session ${sessionId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: events.length,
        sessionId 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[player-events] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

/**
 * Track QoS metric for channel
 */
async function trackQoSMetric(
  supabase: any,
  contentId: string,
  metricType: string,
  value: number
): Promise<void> {
  try {
    // Check if channel exists in m3u_channels
    const { data: channel } = await supabase
      .from('m3u_channels')
      .select('id')
      .eq('id', contentId)
      .single();

    if (!channel) return;

    // Update channel demand stats with QoS data
    // This could be expanded to a dedicated QoS table
    await supabase.rpc('update_channel_qos_metric', {
      p_channel_id: contentId,
      p_metric_type: metricType,
      p_value: value,
    }).catch(() => {
      // RPC might not exist yet, log and continue
      console.log(`[player-events] QoS metric RPC not available: ${metricType}`);
    });
  } catch (error) {
    // Non-critical, just log
    console.warn('[player-events] QoS tracking failed:', error);
  }
}
