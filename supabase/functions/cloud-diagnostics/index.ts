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
    // Tentar diferentes variáveis de ambiente
    const supabaseUrl = Deno.env.get('SUPABASE_CLOUD_URL') || 
                        Deno.env.get('SUPABASE_URL') ||
                        'https://sdvyxdghxqmntyoweqbd.supabase.co';
    const supabaseKey = Deno.env.get('SUPABASE_CLOUD_SERVICE_ROLE_KEY') || 
                        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({
        error: 'Missing SUPABASE_CLOUD_URL or SUPABASE_CLOUD_SERVICE_ROLE_KEY',
        configured: {
          url: !!supabaseUrl,
          key: !!supabaseKey
        }
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });

    // Diagnóstico completo
    const diagnostics: Record<string, any> = {
      project: {
        url: supabaseUrl,
        projectRef: supabaseUrl.split('//')[1]?.split('.')[0] || 'unknown'
      },
      timestamp: new Date().toISOString()
    };

    // 1. Contar usuários auth
    const { count: usersCount, error: usersError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    
    diagnostics.profiles = {
      count: usersCount,
      error: usersError?.message
    };

    // 2. Verificar user_roles
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role, user_id')
      .limit(50);
    
    diagnostics.user_roles = {
      count: roles?.length || 0,
      sample: roles?.slice(0, 5),
      error: rolesError?.message
    };

    // 3. Verificar tabelas existentes
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_table_list')
      .catch(() => ({ data: null, error: { message: 'RPC not available' } }));

    if (tablesError || !tables) {
      // Fallback: tentar listar algumas tabelas conhecidas
      const knownTables = [
        'profiles', 'user_roles', 'iptv_channels', 'iptv_categories',
        'subscriptions', 'payments', 'm3u_playlists', 'activity_logs'
      ];
      
      const tableStatus: Record<string, boolean> = {};
      for (const table of knownTables) {
        const { error } = await supabase.from(table).select('id').limit(1);
        tableStatus[table] = !error;
      }
      diagnostics.tables = tableStatus;
    } else {
      diagnostics.tables = tables;
    }

    // 4. Verificar channels
    const { count: channelsCount, error: channelsError } = await supabase
      .from('iptv_channels')
      .select('*', { count: 'exact', head: true });
    
    diagnostics.iptv_channels = {
      count: channelsCount,
      error: channelsError?.message
    };

    // 5. Verificar master user
    const { data: masterRole, error: masterError } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .eq('role', 'master')
      .limit(5);
    
    diagnostics.master_users = {
      count: masterRole?.length || 0,
      users: masterRole,
      error: masterError?.message
    };

    // 6. Verificar profiles do master
    if (masterRole && masterRole.length > 0) {
      const { data: masterProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, nome')
        .in('id', masterRole.map(r => r.user_id));
      
      diagnostics.master_profiles = {
        data: masterProfiles,
        error: profilesError?.message
      };
    }

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
