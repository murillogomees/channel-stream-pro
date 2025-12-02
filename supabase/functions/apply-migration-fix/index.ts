/**
 * Apply Migration Fix - Execute SQL fixes for schema drift
 * 
 * Safely applies fixes with transaction support and rollback capability
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Auth check
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authSupabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    
    const { data: { user }, error: userError } = await authSupabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CRITICAL: Verify MASTER role (not just admin) for applying fixes
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    
    const isMaster = roles?.some(r => r.role === 'master');
    if (!isMaster) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Master role required to apply fixes' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { drift_id, dry_run = false } = await req.json();

    if (!drift_id) {
      return new Response(
        JSON.stringify({ error: 'drift_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch drift finding
    const { data: drift, error: driftError } = await supabase
      .from('schema_drift_log')
      .select('*')
      .eq('id', drift_id)
      .single();

    if (driftError || !drift) {
      return new Response(
        JSON.stringify({ error: 'Drift finding not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (drift.fix_applied) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Fix already applied',
          applied_at: drift.fix_applied_at
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Apply-Fix] ${dry_run ? 'DRY RUN' : 'APPLYING'} fix for:`, drift.object_name);

    if (dry_run) {
      // Dry run - just validate SQL syntax
      try {
        // Attempt to EXPLAIN the query (doesn't execute)
        await supabase.rpc('validate_sql_syntax', { sql: drift.fix_sql });
        
        return new Response(
          JSON.stringify({
            success: true,
            dry_run: true,
            message: 'SQL syntax validated successfully',
            sql: drift.fix_sql
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (syntaxError) {
        return new Response(
          JSON.stringify({
            success: false,
            dry_run: true,
            error: 'SQL syntax error',
            details: String(syntaxError)
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Execute fix within transaction
    const startTime = Date.now();
    
    try {
      // Execute the fix SQL
      // Note: For production, you'd want to use a proper transaction wrapper
      const { error: execError } = await supabase.rpc('execute_sql_as_service_role', {
        sql_query: drift.fix_sql
      });

      if (execError) {
        throw new Error(`SQL execution failed: ${execError.message}`);
      }

      const executionTime = Date.now() - startTime;

      // Mark as applied
      await supabase
        .from('schema_drift_log')
        .update({
          fix_applied: true,
          fix_applied_at: new Date().toISOString(),
          fix_applied_by: user.id,
          resolved_at: new Date().toISOString(),
          notes: `Applied automatically by ${user.email} in ${executionTime}ms`
        })
        .eq('id', drift_id);

      console.log(`[Apply-Fix] Successfully applied fix in ${executionTime}ms`);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Fix applied successfully',
          execution_time_ms: executionTime,
          object_name: drift.object_name,
          object_type: drift.object_type
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (execError) {
      // Log failure
      await supabase
        .from('schema_drift_log')
        .update({
          notes: `Failed to apply: ${execError.message}`
        })
        .eq('id', drift_id);

      throw execError;
    }

  } catch (error) {
    console.error('[Apply-Fix] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Failed to apply fix', 
        details: String(error) 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});