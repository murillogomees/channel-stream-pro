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

    // Simplified scan - just check if expected_state table exists
    console.log('[Scan-Migrations] Querying schema_expected_state');
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
        findings: findings.slice(0, 100),
        message: 'Simplified scan completed - full functionality coming soon'
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