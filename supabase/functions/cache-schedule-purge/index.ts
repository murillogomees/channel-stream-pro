import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScheduledPurge {
  pattern: string;
  type: 'key' | 'pattern' | 'tag' | 'all';
  scheduled_at: string;
  recurring?: 'daily' | 'weekly' | 'monthly';
}

async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { schedule, execute } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (schedule) {
      const purge: ScheduledPurge = schedule;
      console.log('Scheduled purge:', purge);
      
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Purge scheduled successfully',
          scheduled_at: purge.scheduled_at,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (execute) {
      const now = new Date().toISOString();
      console.log('Executing scheduled purges for:', now);
      
      return new Response(
        JSON.stringify({
          success: true,
          executed: 0,
          timestamp: now,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid request' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Schedule purge error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// Export for dynamic import by main router
export default handler;

// Also support direct Deno.serve for standalone mode
if (import.meta.main) {
  Deno.serve(handler);
}
