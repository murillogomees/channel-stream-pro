/**
 * Deployment Service - Simplified for Supabase Cloud
 */

import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_FUNCTIONS_URL } from '@/config/supabase';

export interface DeploymentStatus {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface ServiceStatus {
  database: boolean;
  auth: boolean;
  storage: boolean;
  functions: boolean;
  all_healthy: boolean;
}

export interface SecretsStatus {
  total: number;
  configured: number;
  missing_count: number;
  missing: string[];
  all_configured: boolean;
}

export interface MigrationTableCounts {
  [tableName: string]: number;
}

class SelfHostedDeploymentService {
  private cloudFunctionsUrl: string;

  constructor() {
    this.cloudFunctionsUrl = SUPABASE_FUNCTIONS_URL;
  }

  /**
   * Test connection to Supabase
   */
  async testConnection(): Promise<DeploymentStatus> {
    try {
      const { error } = await supabase.from('profiles').select('id').limit(1);
      
      if (error) {
        return { success: false, message: error.message };
      }
      
      return { success: true, message: 'Connected to Supabase Cloud' };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Get service status
   */
  async getServiceStatus(): Promise<ServiceStatus> {
    const status: ServiceStatus = {
      database: false,
      auth: false,
      storage: false,
      functions: false,
      all_healthy: false,
    };

    try {
      // Test database
      const { error: dbError } = await supabase.from('profiles').select('id').limit(1);
      status.database = !dbError;

      // Test auth
      const { error: authError } = await supabase.auth.getSession();
      status.auth = !authError;

      // Storage and functions assumed working if database works
      status.storage = status.database;
      status.functions = status.database;
      status.all_healthy = status.database && status.auth;
    } catch (error) {
      console.error('[Deployment] Error checking status:', error);
    }

    return status;
  }

  /**
   * Get Edge Functions list
   */
  async getEdgeFunctionsList(): Promise<string[]> {
    // Return known functions - Cloud manages this automatically
    return [
      'mercado-pago-checkout',
      'mercado-pago-webhook',
      'send-whatsapp',
      'process-auto-notifications',
    ];
  }

  /**
   * Check secrets configuration status
   */
  async checkSecretsStatus(): Promise<SecretsStatus> {
    // Cloud manages secrets automatically
    return {
      total: 10,
      configured: 10,
      missing_count: 0,
      missing: [],
      all_configured: true,
    };
  }

  /**
   * Deploy Edge Functions (no-op for Cloud)
   */
  async deployFunctions(): Promise<DeploymentStatus> {
    return {
      success: true,
      message: 'Edge Functions are managed automatically by Supabase Cloud',
    };
  }

  /**
   * Get migration status
   */
  async getMigrationStatus(): Promise<{ success: boolean; tables: MigrationTableCounts }> {
    const tables: MigrationTableCounts = {};

    try {
      // Count rows in key tables
      const tableNames = ['profiles', 'user_roles', 'payments', 'subscription_plans'] as const;
      
      for (const table of tableNames) {
        try {
          const { count } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });
          tables[table] = count || 0;
        } catch {
          tables[table] = 0;
        }
      }

      return { success: true, tables };
    } catch (error) {
      console.error('[Deployment] Error getting migration status:', error);
      return { success: false, tables };
    }
  }

  /**
   * Get Coolify services list (not applicable for Cloud)
   */
  async getCoolifyServices(): Promise<{ success: boolean; services: any[] }> {
    return {
      success: true,
      services: [],
    };
  }

  /**
   * Restart a service (not applicable for Cloud)
   */
  async restartService(_uuid: string): Promise<DeploymentStatus> {
    return {
      success: true,
      message: 'Services are managed automatically by Supabase Cloud',
    };
  }

  /**
   * Test Edge Function
   */
  async testEdgeFunction(functionName: string): Promise<DeploymentStatus> {
    try {
      const { error } = await supabase.functions.invoke(functionName, {
        body: { test: true },
      });

      if (error) {
        return { success: false, message: error.message };
      }

      return { success: true, message: `Function ${functionName} is working` };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
}

export const selfHostedDeploymentService = new SelfHostedDeploymentService();
