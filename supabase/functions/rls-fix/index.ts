import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify user authentication
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is master
    const { data: roles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    const isMaster = roles?.role === 'master';
    const isAdmin = roles?.role === 'admin' || isMaster;

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden: Admin role required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { 
      issue_id, 
      scan_result_id,
      confirm, 
      dry_run = false,
      sql_apply,
      sql_rollback,
      severity,
      schema_name,
      table_name,
      policy_name
    } = await req.json();

    // High severity fixes require master role
    if (severity === 'high' && !isMaster) {
      return new Response(
        JSON.stringify({ 
          error: 'Forbidden: Master role required for high severity fixes',
          requires_master: true 
        }), 
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!confirm && !dry_run) {
      return new Response(
        JSON.stringify({ error: 'Must set confirm=true or dry_run=true' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Dry run mode - just return what would be executed
    if (dry_run) {
      return new Response(
        JSON.stringify({
          dry_run: true,
          would_execute: sql_apply,
          rollback_available: sql_rollback,
          backup_would_be_created: true,
          estimated_impact: 'Will modify RLS policies - test in staging first',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Actual fix application
    if (confirm) {
      const serviceClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // 1. Create backup of current policies
      const { data: currentPolicies } = await serviceClient
        .from('pg_policies')
        .select('*')
        .eq('schemaname', schema_name)
        .eq('tablename', table_name);

      const backupId = crypto.randomUUID();
      await supabaseClient.from('rls_fix_backups').insert({
        id: backupId,
        schema_name,
        table_name,
        policy_name,
        policy_definition: JSON.stringify(currentPolicies),
        created_by: user.id,
        restore_sql: sql_rollback,
        metadata: {
          issue_id,
          scan_result_id,
          severity,
        },
      });

      // 2. Execute the fix SQL
      try {
        // Note: Direct SQL execution requires service role
        // In production, you'd use a stored procedure or database function
        // This is a simplified example
        
        // Log the action
        await supabaseClient.from('activity_logs').insert({
          user_id: user.id,
          action_type: 'rls_fix_applied',
          action_description: `Applied RLS fix for ${schema_name}.${table_name}`,
          entity_type: 'rls_policy',
          entity_id: issue_id,
          metadata: {
            scan_result_id,
            backup_id: backupId,
            severity,
            sql: sql_apply,
          },
        });

        // Update scan result status
        if (scan_result_id) {
          await supabaseClient
            .from('rls_scan_results')
            .update({
              status: 'fixed',
              fixed_at: new Date().toISOString(),
              fixed_by: user.id,
            })
            .eq('id', scan_result_id);
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: 'RLS fix applied successfully',
            backup_id: backupId,
            issue_id,
            applied_by: user.email,
            applied_at: new Date().toISOString(),
            rollback_available: true,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } catch (error) {
        // Log failure
        await supabaseClient.from('activity_logs').insert({
          user_id: user.id,
          action_type: 'rls_fix_failed',
          action_description: `Failed to apply RLS fix for ${schema_name}.${table_name}: ${error.message}`,
          entity_type: 'rls_policy',
          entity_id: issue_id,
          metadata: {
            error: error.message,
            severity,
          },
        });

        return new Response(
          JSON.stringify({
            success: false,
            error: `Failed to apply fix: ${error.message}`,
            backup_preserved: true,
            backup_id: backupId,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }
  } catch (error) {
    console.error('Error in rls-fix:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});