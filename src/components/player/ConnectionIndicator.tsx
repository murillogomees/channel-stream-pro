/**
 * ============================================================================
 * ConnectionIndicator - Network Quality Display
 * ============================================================================
 */

import React from 'react';
import { Wifi, WifiOff, Signal, SignalLow, SignalMedium, SignalHigh } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConnectionQuality } from '@/services/connectionService';

interface ConnectionIndicatorProps {
  quality: ConnectionQuality | 'unknown';
  downlink?: number;
  isOnline?: boolean;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ConnectionIndicator({
  quality,
  downlink,
  isOnline = true,
  showLabel = false,
  size = 'md',
  className,
}: ConnectionIndicatorProps) {
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const labelSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  if (!isOnline) {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        <WifiOff className={cn(sizeClasses[size], 'text-destructive')} />
        {showLabel && (
          <span className={cn(labelSizeClasses[size], 'text-destructive')}>
            Offline
          </span>
        )}
      </div>
    );
  }

  const getQualityConfig = (q: ConnectionQuality | 'unknown') => {
    switch (q) {
      case 'excellent':
        return {
          icon: SignalHigh,
          color: 'text-green-500',
          label: 'Excelente',
          bars: 4,
        };
      case 'good':
        return {
          icon: SignalMedium,
          color: 'text-blue-500',
          label: 'Boa',
          bars: 3,
        };
      case 'fair':
        return {
          icon: SignalLow,
          color: 'text-yellow-500',
          label: 'Regular',
          bars: 2,
        };
      case 'poor':
        return {
          icon: Signal,
          color: 'text-red-500',
          label: 'Fraca',
          bars: 1,
        };
      default:
        return {
          icon: Wifi,
          color: 'text-muted-foreground',
          label: 'Verificando...',
          bars: 0,
        };
    }
  };

  const config = getQualityConfig(quality);
  const Icon = config.icon;

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <Icon className={cn(sizeClasses[size], config.color)} />
      {showLabel && (
        <div className="flex flex-col">
          <span className={cn(labelSizeClasses[size], config.color)}>
            {config.label}
          </span>
          {downlink !== undefined && downlink > 0 && (
            <span className="text-xs text-muted-foreground">
              {downlink.toFixed(1)} Mbps
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default ConnectionIndicator;
