/**
 * Self-Hosted Deployment Service
 * 
 * Manages Edge Functions deployment to self-hosted Supabase via Coolify
 */

import { selfHostedSupabase, selfHostedConfig } from '@/integrations/selfhosted/client';

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

import { SUPABASE_FUNCTIONS_URL } from '@/config/supabase';

export interface MigrationTableCounts {
  [tableName: string]: number;
}

class SelfHostedDeploymentService {
  private cloudFunctionsUrl: string;

  constructor() {
    // Use self-hosted functions directly
    this.cloudFunctionsUrl = `${SUPABASE_FUNCTIONS_URL}`;
  }

  /**
   * Test connection to self-hosted Supabase
   */
  async testConnection(): Promise<DeploymentStatus> {
    try {
      const response = await fetch(`${this.cloudFunctionsUrl}/coolify-api`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ action: 'test-selfhosted-connection' }),
      });

      const result = await response.json();
      return {
        success: result.success,
        message: result.success ? 'Connection successful' : 'Connection failed',
        details: result.data,
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get self-hosted service status
   */
  async getServiceStatus(): Promise<ServiceStatus> {
    try {
      const response = await fetch(`${this.cloudFunctionsUrl}/coolify-api`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ action: 'get-selfhosted-status' }),
      });

      const result = await response.json();
      return result.data?.checks || {
        database: false,
        auth: false,
        storage: false,
        functions: false,
        all_healthy: false,
      };
    } catch (error) {
      console.error('[SelfHostedDeployment] Status check error:', error);
      return {
        database: false,
        auth: false,
        storage: false,
        functions: false,
        all_healthy: false,
      };
    }
  }

  /**
   * Get list of Edge Functions
   */
  async getEdgeFunctionsList(): Promise<string[]> {
    try {
      const response = await fetch(`${this.cloudFunctionsUrl}/coolify-api`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ action: 'get-edge-functions-list' }),
      });

      const result = await response.json();
      return result.data?.functions || [];
    } catch (error) {
      console.error('[SelfHostedDeployment] Functions list error:', error);
      return [];
    }
  }

  /**
   * Check secrets configuration status
   */
  async checkSecretsStatus(): Promise<SecretsStatus> {
    try {
      const response = await fetch(`${this.cloudFunctionsUrl}/coolify-api`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ action: 'sync-secrets-to-coolify' }),
      });

      const result = await response.json();
      return result.data || {
        total: 0,
        configured: 0,
        missing_count: 0,
        missing: [],
        all_configured: false,
      };
    } catch (error) {
      console.error('[SelfHostedDeployment] Secrets check error:', error);
      return {
        total: 0,
        configured: 0,
        missing_count: 0,
        missing: [],
        all_configured: false,
      };
    }
  }

  /**
   * Deploy Edge Functions to Coolify
   */
  async deployFunctions(): Promise<DeploymentStatus> {
    try {
      const response = await fetch(`${this.cloudFunctionsUrl}/coolify-api`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ action: 'deploy-functions-to-coolify' }),
      });

      const result = await response.json();
      return {
        success: result.success,
        message: result.success 
          ? 'Edge Functions deployment triggered successfully' 
          : result.error || 'Deployment failed',
        details: result.data,
      };
    } catch (error) {
      return {
        success: false,
        message: `Deployment error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get migration status with table counts
   */
  async getMigrationStatus(): Promise<{ success: boolean; tables: MigrationTableCounts }> {
    try {
      const response = await fetch(`${this.cloudFunctionsUrl}/coolify-api`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ action: 'get-migration-status' }),
      });

      const result = await response.json();
      return {
        success: result.success,
        tables: result.data?.tables || {},
      };
    } catch (error) {
      console.error('[SelfHostedDeployment] Migration status error:', error);
      return {
        success: false,
        tables: {},
      };
    }
  }

  /**
   * Get Coolify services list
   */
  async getCoolifyServices(): Promise<{ success: boolean; services: any[] }> {
    try {
      const response = await fetch(`${this.cloudFunctionsUrl}/coolify-api`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ action: 'list-services' }),
      });

      const result = await response.json();
      
      // Handle various response formats from Coolify API
      let services: any[] = [];
      if (Array.isArray(result.data)) {
        services = result.data;
      } else if (result.data?.data && Array.isArray(result.data.data)) {
        services = result.data.data;
      } else if (Array.isArray(result)) {
        services = result;
      }
      
      return {
        success: result.success !== false,
        services,
      };
    } catch (error) {
      console.error('[SelfHostedDeployment] Coolify services error:', error);
      return {
        success: false,
        services: [],
      };
    }
  }

  /**
   * Restart a Coolify service
   */
  async restartService(uuid: string): Promise<DeploymentStatus> {
    try {
      const response = await fetch(`${this.cloudFunctionsUrl}/coolify-api`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ 
          action: 'restart-service',
          params: { uuid }
        }),
      });

      const result = await response.json();
      return {
        success: result.success,
        message: result.success ? 'Service restart triggered' : 'Restart failed',
        details: result.data,
      };
    } catch (error) {
      return {
        success: false,
        message: `Restart error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Test Edge Function on self-hosted
   */
  async testEdgeFunction(functionName: string): Promise<DeploymentStatus> {
    try {
      const response = await fetch(
        `${selfHostedConfig.url}/functions/v1/${functionName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${selfHostedConfig.anonKey}`,
          },
          body: JSON.stringify({ test: true }),
        }
      );

      return {
        success: response.ok,
        message: response.ok 
          ? `Function ${functionName} is working` 
          : `Function ${functionName} returned ${response.status}`,
        details: {
          status: response.status,
          statusText: response.statusText,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Test error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}

export const selfHostedDeploymentService = new SelfHostedDeploymentService();
