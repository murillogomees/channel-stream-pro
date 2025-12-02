/**
 * Scan Migrations - Schema Drift Detection
 * 
 * Compares current database schema against expected state
 * and generates actionable fix recommendations
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DriftFinding {
  object_type: string;
  object_name: string;
  drift_type: 'missing' | 'extra' | 'modified' | 'outdated';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  current_state: string | null;
  expected_state: string | null;
  fix_sql: string;
  metadata: Record<string, any>;
}

serve(async (req) => {
  console.log('[Scan-Migrations] Function started');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('[Scan-Migrations] Environment check:', { 
      hasUrl: !!supabaseUrl, 
      hasKey: !!supabaseServiceKey 
    });

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[Scan-Migrations] Missing environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('[Scan-Migrations] Supabase client created');

    // Auth check
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.log('[Scan-Migrations] No auth header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!anonKey) {
      console.error('[Scan-Migrations] Missing SUPABASE_ANON_KEY');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authSupabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    
    console.log('[Scan-Migrations] Checking user auth');
    const { data: { user }, error: userError } = await authSupabase.auth.getUser();
    
    if (userError || !user) {
      console.log('[Scan-Migrations] Auth failed:', userError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Scan-Migrations] User authenticated:', user.email);

    // Verify admin/master role
    console.log('[Scan-Migrations] Checking user roles');
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    
    if (rolesError) {
      console.error('[Scan-Migrations] Roles query error:', rolesError);
      return new Response(
        JSON.stringify({ error: 'Database error', details: rolesError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const isAdmin = roles?.some(r => r.role === 'admin' || r.role === 'master');
    console.log('[Scan-Migrations] User roles:', roles, 'isAdmin:', isAdmin);
    
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Scan-Migrations] Starting schema drift scan by:', user.email);

    const scanId = crypto.randomUUID();
    const findings: DriftFinding[] = [];

    // 1. Check for missing critical tables
    console.log('[Scan-Migrations] Querying schema_expected_state for tables');
    const { data: expectedTables, error: expectedError } = await supabase
      .from('schema_expected_state')
      .select('*')
      .eq('object_type', 'table')
      .eq('check_enabled', true)
      .order('priority', { ascending: false });

    if (expectedError) {
      console.error('[Scan-Migrations] Error querying expected state:', expectedError);
      return new Response(
        JSON.stringify({ 
          error: 'Database query failed', 
          details: expectedError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Scan-Migrations] Found expected tables:', expectedTables?.length || 0);

    for (const expected of expectedTables || []) {
      console.log('[Scan-Migrations] Checking table:', expected.object_name);
      const { data: tableExists, error: tableError } = await supabase.rpc('pg_table_is_visible', {
        table_name: expected.object_name
      });

      if (tableError) {
        console.error('[Scan-Migrations] Error checking table:', tableError);
        continue;
      }

      if (!tableExists) {
        console.log('[Scan-Migrations] Missing table:', expected.object_name);
        findings.push({
          object_type: 'table',
          object_name: expected.object_name,
          drift_type: 'missing',
          severity: expected.is_critical ? 'critical' : 'high',
          current_state: null,
          expected_state: expected.definition,
          fix_sql: expected.definition,
          metadata: { priority: expected.priority, schema: expected.object_schema }
        });
      }
    }

    // 2. Check for missing RLS policies on critical tables
    console.log('[Scan-Migrations] Checking RLS policies');
    const { data: criticalTables } = await supabase
      .from('schema_expected_state')
      .select('object_name')
      .eq('object_type', 'table')
      .eq('is_critical', true);

    for (const table of criticalTables || []) {
      const { data: policies, error: policiesError } = await supabase
        .rpc('get_table_policies', { table_name: table.object_name });

      if (policiesError) {
        console.error('[Scan-Migrations] Error checking policies:', policiesError);
        continue;
      }

      if (!policies || policies.length === 0) {
        console.log('[Scan-Migrations] Missing RLS policies for:', table.object_name);
        findings.push({
          object_type: 'policy',
          object_name: `${table.object_name}_rls`,
          drift_type: 'missing',
          severity: 'critical',
          current_state: 'No RLS policies found',
          expected_state: 'At least one RLS policy required',
          fix_sql: `-- Example RLS policy for ${table.object_name}
CREATE POLICY "Admin and Master access ${table.object_name}"
ON public.${table.object_name}
FOR ALL
USING (is_admin_or_master(auth.uid()));`,
          metadata: { table: table.object_name }
        });
      }
    }

    // 3. Check for missing indexes
    console.log('[Scan-Migrations] Checking indexes');
    const { data: expectedIndexes } = await supabase
      .from('schema_expected_state')
      .select('*')
      .eq('object_type', 'index')
      .eq('check_enabled', true);

    for (const expected of expectedIndexes || []) {
      const { data: indexExists, error: indexError } = await supabase
        .rpc('pg_index_exists', {
          index_name: expected.object_name
        });

      if (indexError) {
        console.error('[Scan-Migrations] Error checking index:', indexError);
        continue;
      }

      if (!indexExists) {
        console.log('[Scan-Migrations] Missing index:', expected.object_name);
        findings.push({
          object_type: 'index',
          object_name: expected.object_name,
          drift_type: 'missing',
          severity: expected.is_critical ? 'high' : 'medium',
          current_state: null,
          expected_state: expected.definition,
          fix_sql: expected.definition,
          metadata: { 
            priority: expected.priority,
            table: expected.parent_object
          }
        });
      }
    }

    // 4. Check for unapplied migrations
    console.log('[Scan-Migrations] Checking pending migrations');
    const { data: pendingMigrations } = await supabase
      .from('schema_migrations_tracking')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    for (const migration of pendingMigrations || []) {
      console.log('[Scan-Migrations] Found pending migration:', migration.migration_name);
      findings.push({
        object_type: 'migration',
        object_name: migration.migration_name,
        drift_type: 'outdated',
        severity: 'high',
        current_state: 'Not applied',
        expected_state: 'Should be applied',
        fix_sql: `-- Apply migration: ${migration.migration_file}
-- Run this migration through Supabase Dashboard or CLI`,
        metadata: {
          file: migration.migration_file,
          created_at: migration.created_at
        }
      });
    }

    // 5. Store findings in drift log
    if (findings.length > 0) {
      console.log('[Scan-Migrations] Storing', findings.length, 'findings');
      const { error: insertError } = await supabase
        .from('schema_drift_log')
        .insert(
          findings.map(f => ({
            scan_id: scanId,
            object_type: f.object_type,
            object_name: f.object_name,
            drift_type: f.drift_type,
            severity: f.severity,
            current_state: f.current_state,
            expected_state: f.expected_state,
            fix_sql: f.fix_sql,
            metadata: f.metadata
          }))
        );

      if (insertError) {
        console.error('[Scan-Migrations] Error storing findings:', insertError);
      }
    }

    // Calculate summary
    const summary = {
      scan_id: scanId,
      total_findings: findings.length,
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
      low: findings.filter(f => f.severity === 'low').length,
      by_type: findings.reduce((acc, f) => {
        acc[f.object_type] = (acc[f.object_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };

    console.log('[Scan-Migrations] Scan complete:', summary);

    return new Response(
      JSON.stringify({
        success: true,
        scan_id: scanId,
        summary,
        findings: findings.slice(0, 100)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Scan-Migrations] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});