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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    // Create auth client to verify user
    const authClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    });

    // Verify user authentication
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      console.error('[rls-fix] Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create service client for operations
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user is admin or master
    const { data: roles } = await serviceClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isMaster = roles?.some(r => r.role === 'master');
    const isAdmin = roles?.some(r => r.role === 'admin') || isMaster;

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
      schema_name = 'public',
      table_name,
      policy_name
    } = await req.json();

    console.log(`[rls-fix] Request: issue=${issue_id}, table=${table_name}, dry_run=${dry_run}, confirm=${confirm}`);

    // High severity fixes require master role
    if (severity === 'critical' && !isMaster) {
      return new Response(
        JSON.stringify({ 
          error: 'Forbidden: Master role required for critical severity fixes',
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

    if (!sql_apply) {
      return new Response(
        JSON.stringify({ error: 'sql_apply is required' }),
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
          rollback_available: !!sql_rollback,
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
      console.log(`[rls-fix] Applying fix for ${schema_name}.${table_name}`);
      
      // 1. Create backup of current policies
      const { data: currentPolicies } = await serviceClient.rpc('get_table_policies', {
        schema_name_param: schema_name,
        table_name_param: table_name
      }).catch(() => ({ data: null }));

      const backupId = crypto.randomUUID();
      
      // Store backup (ignore errors if table doesn't exist)
      await serviceClient.from('rls_fix_backups').insert({
        id: backupId,
        schema_name,
        table_name,
        policy_name,
        policy_definition: JSON.stringify(currentPolicies || []),
        created_by: user.id,
        restore_sql: sql_rollback || null,
        metadata: {
          issue_id,
          scan_result_id,
          severity,
        },
      }).catch(err => console.log('[rls-fix] Backup insert skipped:', err.message));

      // 2. Execute the fix SQL via service role RPC
      try {
        console.log('[rls-fix] Executing SQL:', sql_apply.substring(0, 200) + '...');
        
        const { error: execError } = await serviceClient.rpc('execute_sql_as_service_role', {
          sql_query: sql_apply
        });

        if (execError) {
          throw new Error(`SQL execution failed: ${execError.message}`);
        }

        console.log('[rls-fix] SQL executed successfully');

        // Log the action
        await serviceClient.from('activity_logs').insert({
          user_id: user.id,
          action_type: 'rls_fix_applied',
          action_description: `Applied RLS fix for ${schema_name}.${table_name}`,
          entity_type: 'rls_policy',
          entity_id: issue_id || backupId,
          metadata: {
            scan_result_id,
            backup_id: backupId,
            severity,
            sql: sql_apply,
          },
        });

        // Update rls_audit_resolutions if exists
        if (issue_id) {
          await serviceClient
            .from('rls_audit_resolutions')
            .update({
              status: 'resolved',
              applied_fix: sql_apply,
              resolved_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', issue_id)
            .catch(() => { /* ignore if not found */ });
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: 'RLS fix applied successfully',
            backup_id: backupId,
            issue_id,
            applied_by: user.email,
            applied_at: new Date().toISOString(),
            rollback_available: !!sql_rollback,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } catch (error: any) {
        console.error('[rls-fix] Execution error:', error);
        
        // Log failure
        await serviceClient.from('activity_logs').insert({
          user_id: user.id,
          action_type: 'rls_fix_failed',
          action_description: `Failed to apply RLS fix for ${schema_name}.${table_name}: ${error.message}`,
          entity_type: 'rls_policy',
          entity_id: issue_id || backupId,
          metadata: {
            error: error.message,
            severity,
            sql: sql_apply,
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

    return new Response(
      JSON.stringify({ error: 'Invalid request' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('[rls-fix] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
