/**
 * Self-Hosted Supabase Integration
 * 
 * Export all self-hosted related utilities
 */

export { 
  selfHostedSupabase, 
  selfHostedConfig, 
  getSelfHostedFunctionUrl,
  invokeSelfHostedFunction 
} from './client';

export { MigrationService, migrationService } from './migration-service';
export type { MigrationStatus, MigrationProgress, TableMigrationResult } from './migration-service';
