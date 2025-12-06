/**
 * Stats Overlay Component
 * 
 * Real-time player statistics display
 */

import React from 'react';
import { Activity, Wifi, Monitor, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PlayerStats } from '../hooks/useAdvancedPlayerControls';

interface StatsOverlayProps {
  stats: PlayerStats;
  isVisible: boolean;
  className?: string;
}

export function StatsOverlay({ stats, isVisible, className }: StatsOverlayProps) {
  if (!isVisible) return null;

  const getBitrateColor = () => {
    const mbps = stats.bitrate / 1_000_000;
    if (mbps >= 5) return 'text-green-400';
    if (mbps >= 2) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getBufferColor = () => {
    if (stats.bufferLength >= 10) return 'text-green-400';
    if (stats.bufferLength >= 5) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div 
      className={cn(
        'absolute top-16 left-4 z-40',
        'bg-black/80 backdrop-blur-sm rounded-lg p-3 min-w-[200px]',
        'font-mono text-xs text-white/90',
        'animate-in fade-in slide-in-from-left duration-200',
        className
      )}
    >
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/20">
        <Activity className="w-4 h-4 text-primary" />
        <span className="font-semibold">Player Stats</span>
      </div>

      <div className="space-y-1.5">
        {/* Resolution */}
        <StatRow 
          icon={<Monitor className="w-3 h-3" />}
          label="Resolução"
          value={stats.resolution}
        />

        {/* Bitrate */}
        <StatRow 
          icon={<Wifi className="w-3 h-3" />}
          label="Bitrate"
          value={`${(stats.bitrate / 1_000_000).toFixed(2)} Mbps`}
          valueClass={getBitrateColor()}
        />

        {/* FPS */}
        <StatRow 
          icon={<Activity className="w-3 h-3" />}
          label="FPS"
          value={stats.fps.toString()}
        />

        {/* Buffer */}
        <StatRow 
          icon={<Clock className="w-3 h-3" />}
          label="Buffer"
          value={`${stats.bufferLength.toFixed(1)}s`}
          valueClass={getBufferColor()}
        />

        {/* Dropped Frames */}
        {stats.droppedFrames > 0 && (
          <StatRow 
            icon={<AlertTriangle className="w-3 h-3 text-yellow-400" />}
            label="Frames Perdidos"
            value={stats.droppedFrames.toString()}
            valueClass="text-yellow-400"
          />
        )}

        {/* Latency */}
        {stats.latency > 0 && (
          <StatRow 
            icon={<Activity className="w-3 h-3" />}
            label="Latência"
            value={`${stats.latency}ms`}
          />
        )}

        {/* Codec */}
        {stats.codec !== '-' && (
          <StatRow 
            icon={<Monitor className="w-3 h-3" />}
            label="Codec"
            value={stats.codec}
          />
        )}
      </div>
    </div>
  );
}

function StatRow({ 
  icon, 
  label, 
  value, 
  valueClass 
}: { 
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-1.5 text-white/60">
        {icon}
        <span>{label}</span>
      </div>
      <span className={cn('font-medium', valueClass)}>{value}</span>
    </div>
  );
}

export default StatsOverlay;
