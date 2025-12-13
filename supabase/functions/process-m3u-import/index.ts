/**
 * @deprecated LEGADO - Use fetch-m3u em vez disso.
 * Esta função será removida em breve.
 * 
 * A função fetch-m3u agora faz tudo:
 * - Aceita URL ou content
 * - Grava direto em iptv_channels
 * - Retorna { success, inserted, skipped, total, message }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.warn('[process-m3u-import] DEPRECATED: Use fetch-m3u instead');

  // Redireciona para fetch-m3u
  try {
    const payload = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Chama fetch-m3u internamente
    const { data, error } = await supabase.functions.invoke('fetch-m3u', {
      body: payload
    });

    if (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[process-m3u-import] Error:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
