/**
 * ============================================================================
 * RecoveryStatus - Error Recovery Status Display
 * ============================================================================
 */

import React from 'react';
import { AlertTriangle, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RecoveryStats } from '@/services/errorRecoveryService';

interface RecoveryStatusProps {
  isRecovering: boolean;
  recoveryRate: number;
  stats?: RecoveryStats | null;
  showDetails?: boolean;
  className?: string;
}

export function RecoveryStatus({
  isRecovering,
  recoveryRate,
  stats,
  showDetails = false,
  className,
}: RecoveryStatusProps) {
  if (!isRecovering && (!stats || stats.totalErrors === 0)) {
    return null;
  }

  return (
    <div className={cn(
      'flex items-center gap-2 px-2 py-1 rounded-md bg-background/80 backdrop-blur-sm',
      className
    )}>
      {isRecovering ? (
        <>
          <RefreshCw className="w-4 h-4 text-yellow-500 animate-spin" />
          <span className="text-sm text-yellow-500">Recuperando...</span>
        </>
      ) : recoveryRate >= 90 ? (
        <>
          <CheckCircle className="w-4 h-4 text-green-500" />
          {showDetails && (
            <span className="text-sm text-green-500">{recoveryRate}% recuperado</span>
          )}
        </>
      ) : recoveryRate >= 50 ? (
        <>
          <AlertTriangle className="w-4 h-4 text-yellow-500" />
          {showDetails && (
            <span className="text-sm text-yellow-500">{recoveryRate}% recuperado</span>
          )}
        </>
      ) : (
        <>
          <XCircle className="w-4 h-4 text-red-500" />
          {showDetails && (
            <span className="text-sm text-red-500">Conexão instável</span>
          )}
        </>
      )}

      {showDetails && stats && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground ml-2">
          <span>{stats.totalErrors} erros</span>
          <span>•</span>
          <span>{stats.recoveredErrors} recuperados</span>
          {stats.qualityFallbacks > 0 && (
            <>
              <span>•</span>
              <span>{stats.qualityFallbacks} fallbacks</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default RecoveryStatus;
