import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://sdvyxdghxqmntyoweqbd.supabase.co',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface UserWithRoles {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  roles: string[];
  profile?: {
    nome: string;
    telefone: string | null;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create anon client to verify JWT and get user
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get authenticated user
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', user.id);

    // Check if user is admin using RLS-protected query
    const { data: roleData, error: roleError } = await anonClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError) {
      console.error('Role check error:', roleError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify admin role' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!roleData) {
      console.log('User is not admin:', user.id);
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Admin verified, fetching users...');

    // Create service_role client for admin operations
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // List all users using service role
    const { data: usersData, error: usersError } = await serviceClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (usersError) {
      console.error('List users error:', usersError);
      return new Response(
        JSON.stringify({ error: 'Failed to list users', details: usersError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${usersData.users.length} users`);

    // Fetch roles and profiles for all users in parallel
    const userIds = usersData.users.map(u => u.id);
    
    const [rolesResult, profilesResult] = await Promise.all([
      anonClient
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds),
      anonClient
        .from('profiles')
        .select('id, nome, telefone')
        .in('id', userIds),
    ]);

    // Build roles map
    const rolesMap = new Map<string, string[]>();
    if (rolesResult.data) {
      for (const roleRow of rolesResult.data) {
        if (!rolesMap.has(roleRow.user_id)) {
          rolesMap.set(roleRow.user_id, []);
        }
        rolesMap.get(roleRow.user_id)!.push(roleRow.role);
      }
    }

    // Build profiles map
    const profilesMap = new Map<string, any>();
    if (profilesResult.data) {
      for (const profile of profilesResult.data) {
        profilesMap.set(profile.id, {
          nome: profile.nome,
          telefone: profile.telefone,
        });
      }
    }

    // Combine data
    const enrichedUsers: UserWithRoles[] = usersData.users.map(user => ({
      id: user.id,
      email: user.email || '',
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at || null,
      roles: rolesMap.get(user.id) || [],
      profile: profilesMap.get(user.id),
    }));

    console.log('Successfully enriched user data');

    return new Response(
      JSON.stringify({ users: enrichedUsers }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
