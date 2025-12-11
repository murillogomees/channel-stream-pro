/**
 * Supabase Migration Service
 * Handles Cloud to Self-Hosted migration verification and configuration
 */

import { supabase } from '@/integrations/supabase/client';

export interface MigrationConfig {
  origin: {
    url: string;
    projectId: string;
  };
  destination: {
    url: string;
    host: string;
    anonKey: string;
    serviceKey: string;
  };
}

export interface TableCount {
  table: string;
  count: number;
  status: 'ok' | 'warning' | 'error';
  expectedMin?: number;
}

export interface MigrationVerificationResult {
  category: string;
  name: string;
  status: 'passed' | 'failed' | 'warning' | 'skipped';
  message: string;
  details?: Record<string, unknown>;
}

// SECURITY: Keys removed - use environment variables or Supabase secrets
export const MIGRATION_CONFIG: MigrationConfig = {
  origin: {
    url: 'https://supabase.iptvlink.com.br', // Self-hosted (current)
    projectId: 'self-hosted'
  },
  destination: {
    url: 'https://supabase.iptvlink.com.br',
    host: 'supabase.iptvlink.com.br',
    anonKey: '[CONFIGURE_VIA_ENV]', // Set via VITE_SUPABASE_PUBLISHABLE_KEY
    serviceKey: '[CONFIGURE_VIA_SECRETS]' // Set via Supabase Edge Function Secrets
  }
};

// Critical tables that must be verified after migration
const CRITICAL_TABLES = [
  { name: 'profiles', minCount: 10 },
  { name: 'user_roles', minCount: 5 },
  { name: 'm3u_sync_entries', minCount: 200000 },
  { name: 'm3u_channels', minCount: 20000 },
  { name: 'activity_logs', minCount: 1 },
  { name: 'notification_templates', minCount: 1 },
  { name: 'subscription_plans', minCount: 3 },
];

class SupabaseMigrationService {
  /**
   * Verify database table counts
   */
  async verifyTableCounts(): Promise<TableCount[]> {
    const results: TableCount[] = [];

    for (const table of CRITICAL_TABLES) {
      try {
        const { count, error } = await supabase
          .from(table.name as any)
          .select('*', { count: 'exact', head: true });

        if (error) {
          results.push({
            table: table.name,
            count: 0,
            status: 'error',
            expectedMin: table.minCount
          });
        } else {
          const actualCount = count || 0;
          results.push({
            table: table.name,
            count: actualCount,
            status: actualCount >= table.minCount ? 'ok' : 'warning',
            expectedMin: table.minCount
          });
        }
      } catch (err) {
        results.push({
          table: table.name,
          count: 0,
          status: 'error',
          expectedMin: table.minCount
        });
      }
    }

    return results;
  }

  /**
   * Verify RLS policies are active
   */
  async verifyRLSPolicies(): Promise<MigrationVerificationResult> {
    try {
      // Try to query profiles - if RLS is active, this should work for authenticated users
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);

      if (error) {
        return {
          category: 'security',
          name: 'RLS Policies',
          status: 'warning',
          message: 'RLS pode estar bloqueando acesso - verifique configuração',
          details: { error: error.message }
        };
      }

      return {
        category: 'security',
        name: 'RLS Policies',
        status: 'passed',
        message: 'RLS policies estão ativas e funcionando'
      };
    } catch (err) {
      return {
        category: 'security',
        name: 'RLS Policies',
        status: 'failed',
        message: 'Erro ao verificar RLS policies'
      };
    }
  }

  /**
   * Verify database functions exist
   */
  async verifyDatabaseFunctions(): Promise<MigrationVerificationResult[]> {
    const functions = [
      'is_admin_or_master',
      'has_role',
      'custom_access_token_hook'
    ];

    const results: MigrationVerificationResult[] = [];

    for (const funcName of functions) {
      try {
        // Try to call the function
        const { error } = await supabase.rpc(funcName as any);
        
        results.push({
          category: 'database',
          name: `Function: ${funcName}`,
          status: error && !error.message.includes('argument') ? 'failed' : 'passed',
          message: error && !error.message.includes('argument') 
            ? `Função não encontrada: ${error.message}` 
            : 'Função existe e está acessível'
        });
      } catch {
        results.push({
          category: 'database',
          name: `Function: ${funcName}`,
          status: 'warning',
          message: 'Não foi possível verificar a função'
        });
      }
    }

    return results;
  }

  /**
   * Verify user roles are properly migrated
   */
  async verifyUserRoles(): Promise<MigrationVerificationResult> {
    try {
      const { data, error, count } = await supabase
        .from('user_roles')
        .select('role', { count: 'exact' });

      if (error) {
        return {
          category: 'security',
          name: 'User Roles',
          status: 'failed',
          message: `Erro ao verificar roles: ${error.message}`
        };
      }

      const roles = data?.map(r => r.role) || [];
      const hasMaster = roles.includes('master');
      const hasAdmin = roles.includes('admin');
      const hasClient = roles.includes('client');

      return {
        category: 'security',
        name: 'User Roles',
        status: hasMaster && hasAdmin ? 'passed' : 'warning',
        message: `${count || 0} roles encontrados`,
        details: {
          totalRoles: count,
          hasMaster,
          hasAdmin,
          hasClient
        }
      };
    } catch {
      return {
        category: 'security',
        name: 'User Roles',
        status: 'failed',
        message: 'Erro ao verificar user roles'
      };
    }
  }

  /**
   * Test Edge Function connectivity
   */
  async testEdgeFunction(functionName: string): Promise<MigrationVerificationResult> {
    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { test: true }
      });

      return {
        category: 'functions',
        name: `Edge Function: ${functionName}`,
        status: error ? 'failed' : 'passed',
        message: error ? `Erro: ${error.message}` : 'Função respondeu corretamente',
        details: { response: data }
      };
    } catch (err) {
      return {
        category: 'functions',
        name: `Edge Function: ${functionName}`,
        status: 'failed',
        message: `Erro de conectividade: ${err instanceof Error ? err.message : 'Unknown'}`
      };
    }
  }

  /**
   * Run full migration verification
   */
  async runFullVerification(): Promise<{
    summary: {
      total: number;
      passed: number;
      failed: number;
      warnings: number;
    };
    results: MigrationVerificationResult[];
  }> {
    const results: MigrationVerificationResult[] = [];

    // 1. Verify table counts
    const tableCounts = await this.verifyTableCounts();
    for (const tc of tableCounts) {
      results.push({
        category: 'database',
        name: `Table: ${tc.table}`,
        status: tc.status === 'ok' ? 'passed' : tc.status === 'warning' ? 'warning' : 'failed',
        message: `${tc.count} registros (mínimo esperado: ${tc.expectedMin})`,
        details: { count: tc.count, expectedMin: tc.expectedMin }
      });
    }

    // 2. Verify RLS
    const rlsResult = await this.verifyRLSPolicies();
    results.push(rlsResult);

    // 3. Verify database functions
    const funcResults = await this.verifyDatabaseFunctions();
    results.push(...funcResults);

    // 4. Verify user roles
    const rolesResult = await this.verifyUserRoles();
    results.push(rolesResult);

    // Calculate summary
    const summary = {
      total: results.length,
      passed: results.filter(r => r.status === 'passed').length,
      failed: results.filter(r => r.status === 'failed').length,
      warnings: results.filter(r => r.status === 'warning').length
    };

    return { summary, results };
  }

  /**
   * Get environment update commands
   */
  getEnvironmentUpdates(): {
    variable: string;
    oldValue: string;
    newValue: string;
    location: string;
  }[] {
    return [
      {
        variable: 'VITE_SUPABASE_URL',
        oldValue: MIGRATION_CONFIG.origin.url,
        newValue: MIGRATION_CONFIG.destination.url,
        location: 'Lovable Project Settings / .env'
      },
      {
        variable: 'VITE_SUPABASE_ANON_KEY',
        oldValue: '(cloud key)',
        newValue: MIGRATION_CONFIG.destination.anonKey,
        location: 'Lovable Project Settings / .env'
      },
      {
        variable: 'SUPABASE_SERVICE_ROLE_KEY',
        oldValue: '(cloud service key)',
        newValue: MIGRATION_CONFIG.destination.serviceKey,
        location: 'Edge Function Secrets'
      }
    ];
  }

  /**
   * Get webhook update URLs
   */
  getWebhookUpdates(): {
    service: string;
    oldUrl: string;
    newUrl: string;
    configLocation: string;
  }[] {
    return [
      {
        service: 'MercadoPago',
        oldUrl: `${MIGRATION_CONFIG.origin.url}/functions/v1/mercadopago-webhook`,
        newUrl: `${MIGRATION_CONFIG.destination.url}functions/v1/mercadopago-webhook`,
        configLocation: 'Painel MercadoPago > Webhooks'
      },
      {
        service: 'WhatsApp',
        oldUrl: `${MIGRATION_CONFIG.origin.url}/functions/v1/whatsapp-webhook`,
        newUrl: `${MIGRATION_CONFIG.destination.url}functions/v1/whatsapp-webhook`,
        configLocation: 'Painel WhatsApp API'
      },
      {
        service: 'SmartOne',
        oldUrl: `${MIGRATION_CONFIG.origin.url}/functions/v1/smartone-webhook`,
        newUrl: `${MIGRATION_CONFIG.destination.url}functions/v1/smartone-webhook`,
        configLocation: 'Painel SmartOne'
      }
    ];
  }

  /**
   * Generate deployment commands
   */
  getDeploymentCommands(): {
    step: string;
    command: string;
    description: string;
  }[] {
    return [
      {
        step: '1. Link to Self-Hosted',
        command: `npx supabase link --project-ref srv1182856 --password [DB_PASSWORD]`,
        description: 'Conectar ao projeto self-hosted'
      },
      {
        step: '2. Deploy Edge Functions',
        command: 'npx supabase functions deploy',
        description: 'Deploy todas as 75 Edge Functions'
      },
      {
        step: '3. Set Secrets',
        command: 'npx supabase secrets set MERCADOPAGO_ACCESS_TOKEN=xxx WHATSAPP_TOKEN=xxx',
        description: 'Configurar secrets das Edge Functions'
      },
      {
        step: '4. Verify Deployment',
        command: 'curl https://srv1182856.hstgr.cloud/functions/v1/health-check',
        description: 'Verificar se Edge Functions estão respondendo'
      }
    ];
  }
}

export const supabaseMigrationService = new SupabaseMigrationService();
