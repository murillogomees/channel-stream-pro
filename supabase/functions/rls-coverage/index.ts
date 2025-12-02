import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RLSIssue {
  id: string;
  severity: 'high' | 'medium' | 'low';
  table: string;
  schema: string;
  action?: string;
  issue: string;
  evidence: string[];
  proposed_fix: {
    summary: string;
    sql_dry_run: string;
    sql_apply: string;
    rollback_sql: string;
  };
  estimated_effort: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify user is admin or master
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: roles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'master']);

    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: 'Forbidden: Admin or Master role required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const scanId = crypto.randomUUID();
    const issues: RLSIssue[] = [];

    // 1. Detect tables without RLS
    const { data: tablesWithoutRLS, error: error1 } = await supabaseClient
      .rpc('detect_tables_without_rls');

    if (!error1 && tablesWithoutRLS) {
      for (const row of tablesWithoutRLS) {
        const issueId = `rls-${issues.length + 1}`.padStart(7, '0');
        issues.push({
          id: issueId,
          severity: row.severity,
          schema: row.schema_name,
          table: row.table_name,
          issue: 'missing_policy',
          evidence: [`No RLS policies found for table ${row.schema_name}.${row.table_name}`],
          proposed_fix: {
            summary: `Enable RLS and create basic SELECT policy for ${row.table_name}`,
            sql_dry_run: `-- Dry run: Enable RLS on ${row.schema_name}.${row.table_name}\nALTER TABLE ${row.schema_name}.${row.table_name} ENABLE ROW LEVEL SECURITY;\n\n-- Create basic policy (customize based on table structure)\nCREATE POLICY "Users view own ${row.table_name}"\n  ON ${row.schema_name}.${row.table_name}\n  FOR SELECT\n  USING (\n    -- Adjust this condition based on your table structure\n    auth.uid() = user_id OR is_admin_or_master(auth.uid())\n  );`,
            sql_apply: `ALTER TABLE ${row.schema_name}.${row.table_name} ENABLE ROW LEVEL SECURITY;\n\nCREATE POLICY "Users view own ${row.table_name}"\n  ON ${row.schema_name}.${row.table_name}\n  FOR SELECT\n  USING (auth.uid() = user_id OR is_admin_or_master(auth.uid()));`,
            rollback_sql: `DROP POLICY IF EXISTS "Users view own ${row.table_name}" ON ${row.schema_name}.${row.table_name};\nALTER TABLE ${row.schema_name}.${row.table_name} DISABLE ROW LEVEL SECURITY;`,
          },
          estimated_effort: 'small',
        });
      }
    }

    // 2. Detect permissive policies
    const { data: permissivePolicies, error: error2 } = await supabaseClient
      .rpc('detect_permissive_policies');

    if (!error2 && permissivePolicies) {
      for (const row of permissivePolicies) {
        const issueId = `rls-${issues.length + 1}`.padStart(7, '0');
        const evidence = [];
        
        if (row.qual && row.qual.match(/^\s*true\s*$/i)) {
          evidence.push(`USING clause is 'true' (allows all rows)`);
        }
        if (row.with_check && row.with_check.match(/^\s*true\s*$/i)) {
          evidence.push(`WITH CHECK clause is 'true' (allows all inserts/updates)`);
        }
        if (!row.qual || row.qual.trim() === '') {
          evidence.push(`USING clause is empty`);
        }

        issues.push({
          id: issueId,
          severity: row.severity,
          schema: row.schema_name,
          table: row.table_name,
          action: row.command,
          issue: 'permissive_policy',
          evidence,
          proposed_fix: {
            summary: `Restrict policy "${row.policy_name}" on ${row.table_name}`,
            sql_dry_run: `-- Dry run: Drop overly permissive policy\nDROP POLICY IF EXISTS "${row.policy_name}" ON ${row.schema_name}.${row.table_name};\n\n-- Create restrictive policy\nCREATE POLICY "${row.policy_name}_restricted"\n  ON ${row.schema_name}.${row.table_name}\n  FOR ${row.command}\n  USING (\n    -- Add proper restrictions based on your security model\n    auth.uid() = user_id OR is_admin_or_master(auth.uid())\n  );`,
            sql_apply: `DROP POLICY IF EXISTS "${row.policy_name}" ON ${row.schema_name}.${row.table_name};\n\nCREATE POLICY "${row.policy_name}_restricted"\n  ON ${row.schema_name}.${row.table_name}\n  FOR ${row.command}\n  USING (auth.uid() = user_id OR is_admin_or_master(auth.uid()));`,
            rollback_sql: `DROP POLICY IF EXISTS "${row.policy_name}_restricted" ON ${row.schema_name}.${row.table_name};\n\nCREATE POLICY "${row.policy_name}"\n  ON ${row.schema_name}.${row.table_name}\n  FOR ${row.command}\n  USING (${row.qual || 'true'})\n  ${row.with_check ? `WITH CHECK (${row.with_check})` : ''};`,
          },
          estimated_effort: 'medium',
        });
      }
    }

    // 3. Get summary
    const { data: summary } = await supabaseClient.rpc('get_rls_coverage_summary');

    // Store scan results
    for (const issue of issues) {
      await supabaseClient.from('rls_scan_results').insert({
        scan_id: scanId,
        severity: issue.severity,
        schema_name: issue.schema,
        table_name: issue.table,
        action: issue.action,
        issue_type: issue.issue,
        evidence: issue.evidence,
        proposed_fix: issue.proposed_fix,
        status: 'pending',
      });
    }

    return new Response(
      JSON.stringify({
        scan_id: scanId,
        timestamp: new Date().toISOString(),
        summary,
        issues,
        total_issues: issues.length,
        by_severity: {
          high: issues.filter(i => i.severity === 'high').length,
          medium: issues.filter(i => i.severity === 'medium').length,
          low: issues.filter(i => i.severity === 'low').length,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in rls-coverage:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});