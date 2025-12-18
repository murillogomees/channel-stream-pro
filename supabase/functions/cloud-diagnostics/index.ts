import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * LOVABLE CLOUD PROJECT: waxgowafohlrfoefwhsf
 * Uses environment variables provided automatically
 */
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });

    const diagnostics: Record<string, any> = {
      project: {
        url: SUPABASE_URL,
        projectRef: 'waxgowafohlrfoefwhsf',
        source: 'Environment Variables - Lovable Cloud'
      },
      timestamp: new Date().toISOString()
    };

    // 1. Profiles
    const { count: profilesCount, error: profilesError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    
    diagnostics.profiles = { count: profilesCount, error: profilesError?.message };

    // 2. User roles
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role, user_id')
      .limit(50);
    
    diagnostics.user_roles = {
      count: roles?.length || 0,
      data: roles,
      error: rolesError?.message
    };

    // 3. Tabelas conhecidas
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

    // 4. IPTV Channels
    const { count: channelsCount } = await supabase
      .from('iptv_channels')
      .select('*', { count: 'exact', head: true });
    
    diagnostics.iptv_channels = { count: channelsCount };

    // 5. Master users
    const { data: masterRoles } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .eq('role', 'master');
    
    diagnostics.master_users = { count: masterRoles?.length || 0, users: masterRoles };

    // 6. All profiles
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('id, email, nome')
      .limit(20);
    
    diagnostics.all_profiles = allProfiles;

    // 7. Auth users count (via auth schema - service role only)
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    diagnostics.auth_users = {
      count: authUsers?.users?.length || 0,
      error: authError?.message,
      sample: authUsers?.users?.slice(0, 5).map(u => ({ id: u.id, email: u.email }))
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
