import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Projeto SUPABASE CLOUD: sdvyxdghxqmntyoweqbd
    const supabaseUrl = Deno.env.get('SUPABASE_CLOUD_URL') || 
                        Deno.env.get('SUPABASE_URL') ||
                        'https://sdvyxdghxqmntyoweqbd.supabase.co';
    const supabaseKey = Deno.env.get('SUPABASE_CLOUD_SERVICE_ROLE_KEY') || 
                        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Diagnóstico completo
    const diagnostics: Record<string, any> = {
      project: {
        url: supabaseUrl,
        projectRef: supabaseUrl.split('//')[1]?.split('.')[0] || 'unknown'
      },
      timestamp: new Date().toISOString(),
      env: {
        SUPABASE_CLOUD_URL: !!Deno.env.get('SUPABASE_CLOUD_URL'),
        SUPABASE_URL: !!Deno.env.get('SUPABASE_URL'),
        SUPABASE_CLOUD_SERVICE_ROLE_KEY: !!Deno.env.get('SUPABASE_CLOUD_SERVICE_ROLE_KEY'),
        SUPABASE_SERVICE_ROLE_KEY: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      }
    };

    if (!supabaseKey) {
      diagnostics.error = 'Missing SERVICE_ROLE_KEY - cannot query database';
      return new Response(JSON.stringify(diagnostics, null, 2), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });

    // 1. Contar profiles
    const { count: profilesCount, error: profilesError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    
    diagnostics.profiles = {
      count: profilesCount,
      error: profilesError?.message
    };

    // 2. Verificar user_roles
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role, user_id')
      .limit(50);
    
    diagnostics.user_roles = {
      count: roles?.length || 0,
      sample: roles?.slice(0, 10),
      error: rolesError?.message
    };

    // 3. Verificar tabelas conhecidas
    const knownTables = [
      'profiles', 'user_roles', 'iptv_channels', 'iptv_categories',
      'subscriptions', 'payments', 'activity_logs', 'iptv_origin_servers'
    ];
    
    const tableStatus: Record<string, any> = {};
    for (const table of knownTables) {
      const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
      tableStatus[table] = { exists: !error, count: count, error: error?.message };
    }
    diagnostics.tables = tableStatus;

    // 4. Verificar channels
    const { count: channelsCount, error: channelsError } = await supabase
      .from('iptv_channels')
      .select('*', { count: 'exact', head: true });
    
    diagnostics.iptv_channels = {
      count: channelsCount,
      error: channelsError?.message
    };

    // 5. Verificar master users
    const { data: masterRoles, error: masterError } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .eq('role', 'master');
    
    diagnostics.master_users = {
      count: masterRoles?.length || 0,
      users: masterRoles,
      error: masterError?.message
    };

    // 6. Buscar profiles dos masters
    if (masterRoles && masterRoles.length > 0) {
      const { data: masterProfiles, error: mpError } = await supabase
        .from('profiles')
        .select('id, email, nome')
        .in('id', masterRoles.map(r => r.user_id));
      
      diagnostics.master_profiles = {
        data: masterProfiles,
        error: mpError?.message
      };
    }

    // 7. Listar todos os profiles com email
    const { data: allProfiles, error: apError } = await supabase
      .from('profiles')
      .select('id, email, nome')
      .limit(20);
    
    diagnostics.all_profiles = {
      data: allProfiles,
      error: apError?.message
    };

    return new Response(JSON.stringify(diagnostics, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
