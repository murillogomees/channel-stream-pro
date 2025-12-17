import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface AdminDataRequest {
  action: 'list-profiles' | 'list-roles' | 'list-activity' | 'get-profile' | 
          'update-profile' | 'delete-profile' | 'create-user' | 'update-role' |
          'list-shortcuts' | 'add-shortcut' | 'delete-shortcut';
  profileId?: string;
  userId?: string;
  data?: Record<string, unknown>;
  filters?: {
    search?: string;
    role?: string;
    status?: string;
    limit?: number;
    offset?: number;
  };
}

// Decode JWT payload without verification (for extracting claims)
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const [, payloadBase64] = token.split('.');
    const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
    return payload;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Use service role client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Validate JWT from Authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const payload = decodeJwtPayload(token);
    
    if (!payload) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Check token expiration
    const exp = payload.exp as number;
    if (exp && exp < Math.floor(Date.now() / 1000)) {
      return new Response(JSON.stringify({ error: 'Token expired' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const userId = payload.sub as string;
    
    // Buscar role diretamente do banco (não confiar no JWT app_role)
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    
    if (rolesError) {
      console.error('[admin-data] Error fetching roles:', rolesError);
      return new Response(JSON.stringify({ error: 'Failed to verify permissions' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Verificar se é admin ou master
    const roles = userRoles?.map(r => r.role) || [];
    const isMaster = roles.includes('master');
    const isAdmin = roles.includes('admin') || isMaster;
    
    if (!isAdmin) {
      console.log('[admin-data] Access denied for user:', userId, 'roles:', roles);
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log('[admin-data] Authorized user:', payload.email, 'roles:', roles);

    const body: AdminDataRequest = await req.json();
    console.log('[admin-data] Request:', body.action);

    switch (body.action) {
      case 'list-profiles': {
        let query = supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (body.filters?.limit) {
          query = query.limit(body.filters.limit);
        }
        if (body.filters?.offset) {
          query = query.range(body.filters.offset, body.filters.offset + (body.filters.limit || 100) - 1);
        }

        const { data: profiles, error } = await query;
        if (error) throw error;

        // Get roles for all profiles
        const profileIds = profiles?.map(p => p.id) || [];
        const { data: roles } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', profileIds);

        // Map roles to profiles
        const rolesMap = new Map<string, string[]>();
        roles?.forEach(r => {
          const existing = rolesMap.get(r.user_id) || [];
          existing.push(r.role);
          rolesMap.set(r.user_id, existing);
        });

        const usersWithRoles = profiles?.map(profile => ({
          ...profile,
          roles: rolesMap.get(profile.id) || ['client'],
        })) || [];

        return new Response(JSON.stringify({ 
          success: true, 
          profiles: usersWithRoles,
          total: profiles?.length || 0
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'list-roles': {
        const { data: roles, error } = await supabase
          .from('user_roles')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        return new Response(JSON.stringify({ success: true, roles }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'list-activity': {
        let query = supabase
          .from('activity_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(body.filters?.limit || 50);

        const { data: activities, error } = await query;
        if (error) throw error;

        return new Response(JSON.stringify({ success: true, activities }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get-profile': {
        if (!body.profileId) {
          return new Response(JSON.stringify({ error: 'profileId required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', body.profileId)
          .single();

        if (error) throw error;

        // Get roles
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', body.profileId);

        return new Response(JSON.stringify({ 
          success: true, 
          profile: {
            ...profile,
            roles: roles?.map(r => r.role) || ['client'],
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'update-profile': {
        if (!body.profileId || !body.data) {
          return new Response(JSON.stringify({ error: 'profileId and data required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Remove readonly fields
        const { id, created_at, updated_at, roles, user_role, ...updateData } = body.data as any;

        const { data: profile, error } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', body.profileId)
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ success: true, profile }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'delete-profile': {
        if (!body.profileId) {
          return new Response(JSON.stringify({ error: 'profileId required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Delete roles first
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', body.profileId);

        // Delete profile
        const { error } = await supabase
          .from('profiles')
          .delete()
          .eq('id', body.profileId);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'update-role': {
        if (!body.profileId || !body.data?.role) {
          return new Response(JSON.stringify({ error: 'profileId and role required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const newRole = body.data.role as string;

        // Delete existing roles
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', body.profileId);

        // Insert new role
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: body.profileId, role: newRole });

        if (error) throw error;

        return new Response(JSON.stringify({ success: true, role: newRole }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'list-shortcuts': {
        if (!body.userId) {
          return new Response(JSON.stringify({ error: 'userId required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { data: shortcuts, error } = await supabase
          .from('admin_shortcuts')
          .select('*')
          .eq('user_id', body.userId)
          .order('order_index');

        if (error) throw error;

        return new Response(JSON.stringify({ success: true, shortcuts }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'add-shortcut': {
        if (!body.userId || !body.data) {
          return new Response(JSON.stringify({ error: 'userId and data required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { data: shortcut, error } = await supabase
          .from('admin_shortcuts')
          .insert({
            user_id: body.userId,
            ...body.data
          })
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ success: true, shortcut }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'delete-shortcut': {
        if (!body.data?.shortcutId) {
          return new Response(JSON.stringify({ error: 'shortcutId required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { error } = await supabase
          .from('admin_shortcuts')
          .delete()
          .eq('id', body.data.shortcutId);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (error) {
    console.error('[admin-data] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});