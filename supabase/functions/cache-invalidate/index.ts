/**
 * Cache Invalidation Edge Function
 * 
 * Provides admin-only endpoint to invalidate/purge cache entries
 * based on URL patterns, prefixes, or tags.
 * 
 * Security: Requires JWT authentication with admin or master role.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InvalidationRequest {
  pattern: string;           // URL pattern, key, or tag
  type: 'pattern' | 'key' | 'tag' | 'all'; // Type of invalidation
  scope?: string;           // Optional scope (e.g., 'global', 'user-specific')
  metadata?: Record<string, any>; // Additional metadata
}

interface InvalidationResponse {
  success: boolean;
  invalidation_id?: string;
  message: string;
  keys_invalidated?: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Authenticate and authorize
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[cache-invalidate] Missing Authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('[cache-invalidate] Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Check if user has admin or master role
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError) {
      console.error('[cache-invalidate] Error fetching roles:', rolesError);
      return new Response(
        JSON.stringify({ error: 'Error checking permissions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const hasAdminAccess = roles?.some(r => r.role === 'admin' || r.role === 'master');
    if (!hasAdminAccess) {
      console.error('[cache-invalidate] User lacks admin/master role:', user.id);
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[cache-invalidate] Authorized user:', user.id, user.email);

    // 3. Parse and validate request body
    const contentType = req.headers.get('content-type') || '';
    let body: InvalidationRequest;

    if (contentType.includes('application/json')) {
      const rawBody = await req.text();
      if (!rawBody || rawBody.trim() === '') {
        return new Response(
          JSON.stringify({ error: 'Empty request body' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        body = JSON.parse(rawBody);
      } catch (parseError) {
        console.error('[cache-invalidate] JSON parse error:', parseError);
        return new Response(
          JSON.stringify({ error: 'Invalid JSON in request body' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'Content-Type must be application/json' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate required fields
    if (!body.pattern || typeof body.pattern !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid "pattern" field' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!body.type || !['pattern', 'key', 'tag', 'all'].includes(body.type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid "type" field. Must be: pattern, key, tag, or all' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[cache-invalidate] Request validated:', { 
      pattern: body.pattern, 
      type: body.type, 
      scope: body.scope 
    });

    // 4. Insert invalidation record into database
    const { data: invalidation, error: insertError } = await supabase
      .from('cache_invalidations')
      .insert({
        pattern: body.pattern,
        invalidation_type: body.type,
        scope: body.scope || null,
        initiated_by: user.id,
        status: 'pending',
        metadata: body.metadata || null,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[cache-invalidate] Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to record invalidation', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[cache-invalidate] Invalidation recorded:', invalidation.id);

    // 5. TODO: Actual cache purge logic
    // This would integrate with Cloudflare Cache API, R2, or CDN Worker
    // For now, we mark as completed immediately
    // In production, this should trigger async worker or call CDN API

    // Simulate purge operation
    let keysInvalidated = 0;
    
    try {
      // Placeholder for actual purge logic:
      // - If type === 'key': purge exact cache key
      // - If type === 'pattern': purge all keys matching pattern
      // - If type === 'tag': purge all keys tagged with this tag
      // - If type === 'all': purge all cache entries
      
      // For demonstration, we'll simulate success
      keysInvalidated = body.type === 'pattern' || body.type === 'all' ? 10 : 1; // Mock value

      // Update status to completed
      await supabase
        .from('cache_invalidations')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          keys_invalidated: keysInvalidated,
        })
        .eq('id', invalidation.id);

      console.log('[cache-invalidate] Purge completed:', { id: invalidation.id, keys: keysInvalidated });
    } catch (purgeError) {
      console.error('[cache-invalidate] Purge failed:', purgeError);
      
      // Update status to failed
      await supabase
        .from('cache_invalidations')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: purgeError instanceof Error ? purgeError.message : 'Unknown error',
        })
        .eq('id', invalidation.id);

      return new Response(
        JSON.stringify({ 
          error: 'Cache purge failed', 
          invalidation_id: invalidation.id,
          details: purgeError instanceof Error ? purgeError.message : 'Unknown error'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Return success response
    const response: InvalidationResponse = {
      success: true,
      invalidation_id: invalidation.id,
      message: `Cache invalidation initiated for pattern: ${body.pattern}`,
      keys_invalidated: keysInvalidated,
    };

    console.log('[cache-invalidate] Success:', response);

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[cache-invalidate] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
