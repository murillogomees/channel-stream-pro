/**
 * useMigrationFlags - React hook for migration feature flags
 * 
 * Provides access to migration-specific feature flags with
 * support for percentage-based rollout and emergency stop.
 */

import { useState, useCallback, useEffect } from 'react';
import { migrationService, MigrationFlag } from '@/services/migrationService';
import { supabase } from '@/integrations/supabase/client';

interface FlagStatus {
  enabled: boolean;
  percentage: number;
  description: string;
  rollbackAvailable: boolean;
}

interface UseMigrationFlagsReturn {
  // Check if a migration flag is enabled
  isEnabled: (flag: MigrationFlag) => boolean;
  
  // Get all migration flags
  getAllFlags: () => Record<MigrationFlag, { enabled: boolean; config: any }>;
  
  // Update a flag (requires admin)
  updateFlag: (flag: MigrationFlag, enabled: boolean, percentage?: number) => Promise<boolean>;
  
  // Emergency stop all migration flags
  emergencyStop: () => void;
  
  // Loading state
  loading: boolean;
  
  // Error state
  error: Error | null;
  
  // Refresh flags from database
  refresh: () => Promise<void>;
}

export function useMigrationFlags(): UseMigrationFlagsReturn {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [, forceUpdate] = useState({});

  // Load flags from database on mount
  const loadFlags = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('feature_flag_config')
        .select('flag_name, enabled, percentage, description');

      if (fetchError) throw fetchError;

      // Update local migration service with database values
      if (data) {
        data.forEach((flag) => {
          if (isMigrationFlag(flag.flag_name)) {
            migrationService.updateMigrationFlag(flag.flag_name as MigrationFlag, {
              enabled: flag.enabled,
              percentage: flag.percentage,
              description: flag.description || '',
            });
          }
        });
      }
    } catch (err) {
      console.error('[useMigrationFlags] Error loading flags:', err);
      setError(err instanceof Error ? err : new Error('Failed to load flags'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFlags();
  }, [loadFlags]);

  const isEnabled = useCallback((flag: MigrationFlag): boolean => {
    return migrationService.isMigrationEnabled(flag);
  }, []);

  const getAllFlags = useCallback(() => {
    return migrationService.getAllMigrationFlags();
  }, []);

  const updateFlag = useCallback(async (
    flag: MigrationFlag,
    enabled: boolean,
    percentage?: number
  ): Promise<boolean> => {
    try {
      const { error } = await supabase.rpc('toggle_feature_flag', {
        p_flag_name: flag,
        p_enabled: enabled,
        p_percentage: percentage ?? (enabled ? 100 : 0),
      });

      if (error) throw error;

      migrationService.updateMigrationFlag(flag, {
        enabled,
        percentage: percentage ?? (enabled ? 100 : 0),
      });

      forceUpdate({});
      return true;
    } catch (err) {
      console.error('[useMigrationFlags] Error updating flag:', err);
      return false;
    }
  }, []);

  const emergencyStop = useCallback(() => {
    migrationService.emergencyStop();
    forceUpdate({});
    
    // Also update database
    supabase
      .from('feature_flag_config')
      .update({ enabled: false, percentage: 0 })
      .in('flag_name', [
        'use_cliente_db_only',
        'disable_legacy_routes',
      ])
      .then(({ error }) => {
        if (error) {
          console.error('[useMigrationFlags] Error in emergency stop DB update:', error);
        }
      });
  }, []);

  return {
    isEnabled,
    getAllFlags,
    updateFlag,
    emergencyStop,
    loading,
    error,
    refresh: loadFlags,
  };
}

// Type guard for migration flags
function isMigrationFlag(flag: string): flag is MigrationFlag {
  return [
    'use_cliente_db_only',
    'disable_legacy_routes',
    'consolidated_whatsapp',
    'new_notification_system',
  ].includes(flag);
}

// Shorthand hooks for common migration flags
export function useClienteDbOnly(): boolean {
  return migrationService.isMigrationEnabled('use_cliente_db_only');
}

export function useConsolidatedWhatsApp(): boolean {
  return migrationService.isMigrationEnabled('consolidated_whatsapp');
}

export function useNewNotificationSystem(): boolean {
  return migrationService.isMigrationEnabled('new_notification_system');
}

export function useLegacyRoutesDisabled(): boolean {
  return migrationService.isMigrationEnabled('disable_legacy_routes');
}

export default useMigrationFlags;
