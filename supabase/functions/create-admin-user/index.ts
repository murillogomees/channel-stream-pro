import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CreateUserRequest {
  email: string;
  password: string;
  nome: string;
  telefone?: string;
  role?: 'admin' | 'super_admin' | 'client';
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Anon client using the caller's JWT
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Check if the user is authenticated
    const { data: { user }, error: userError } = await anonClient.auth.getUser();

    if (userError || !user) {
      console.error('Auth error in create-admin-user:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user in create-admin-user:', user.id);

    // Get request body
    const body: CreateUserRequest = await req.json();
    const { email, password, nome, telefone, role = 'client' } = body;

    if (!email || !password || !nome) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, password, nome' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check user permissions based on what they're trying to create
    const { data: userRoles, error: rolesError } = await anonClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError) {
      console.error('Role check error in create-admin-user:', rolesError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify permissions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isSuperAdmin = userRoles?.some(r => r.role === 'super_admin');
    const isAdmin = userRoles?.some(r => r.role === 'admin') || isSuperAdmin;

    // Permission check:
    // - super_admin can create any type of user (admin, super_admin, client)
    // - admin can only create client users
    if ((role === 'admin' || role === 'super_admin') && !isSuperAdmin) {
      console.log('User is not super_admin, cannot create admin/super_admin users:', user.id);
      return new Response(
        JSON.stringify({ error: 'Forbidden: Only super admins can create admin users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (role === 'client' && !isAdmin) {
      console.log('User is not admin, cannot create client users:', user.id);
      return new Response(
        JSON.stringify({ error: 'Forbidden: Only admins can create client users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Service client for privileged admin operations
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Create the user using admin API
    const { data: newUser, error: createError } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        nome,
        telefone,
      },
    });

    if (createError) {
      console.error('Error creating user in create-admin-user:', createError);
      
      // Check for duplicate email error
      const isDuplicateEmail = createError.message?.includes('already registered') || 
                               createError.message?.includes('already exists') ||
                               createError.message?.includes('duplicate key') ||
                               createError.message?.includes('Database error');
      
      if (isDuplicateEmail) {
        return new Response(
          JSON.stringify({ 
            error: 'Email already registered', 
            details: 'Este email já está registrado no sistema.',
            code: 'EMAIL_EXISTS'
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to create user', details: createError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!newUser.user) {
      return new Response(
        JSON.stringify({ error: 'User creation failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Note: The trigger handle_new_user_role already assigns 'client' role automatically
    // For admin/super_admin users, we need to explicitly add the role
    if (role === 'admin' || role === 'super_admin') {
      const { error: roleError } = await serviceClient
        .from('user_roles')
        .insert({
          user_id: newUser.user.id,
          role: role,
        });

      if (roleError) {
        console.error(`Error assigning ${role} role in create-admin-user:`, roleError);
        return new Response(
          JSON.stringify({
            error: `User created but failed to assign ${role} role`,
            details: roleError.message,
            userId: newUser.user.id,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Also add admin role for super_admin (they need both)
      if (role === 'super_admin') {
        await serviceClient
          .from('user_roles')
          .insert({
            user_id: newUser.user.id,
            role: 'admin',
          });
      }
    }

    console.log(`User created successfully: ${newUser.user.id} with role: ${role}`);

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUser.user.id,
          email: newUser.user.email,
          nome,
          role,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error in create-admin-user:', error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
