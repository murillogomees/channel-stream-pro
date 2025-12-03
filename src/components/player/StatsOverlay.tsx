/**
 * StatsOverlay - Debug statistics overlay for player
 * 
 * Shows real-time playback statistics: bitrate, buffer, fps, latency
 */

import React, { memo, useState, useEffect, useCallback, useRef } from 'react';
import Hls from 'hls.js';
import { cn } from '@/lib/utils';
import { X, Activity, Wifi, Clock, Gauge, HardDrive, Video } from 'lucide-react';

interface PlaybackStats {
  // Video
  resolution: string;
  fps: number;
  codec: string;
  
  // Network
  bandwidth: number;        // bits per second
  estimatedBandwidth: number;
  downloadSpeed: number;    // bytes per second
  
  // Buffer
  bufferLength: number;     // seconds
  bufferSize: number;       // bytes
  bufferStalls: number;
  
  // Latency (live)
  latency: number;
  liveEdge: number;
  
  // Quality
  currentLevel: number;
  maxLevel: number;
  levelBitrate: number;
  
  // Fragments
  fragmentsLoaded: number;
  fragmentDuration: number;
  
  // Playback
  currentTime: number;
  duration: number;
  playbackRate: number;
  dropped: number;
}

interface StatsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

function formatBitrate(bps: number): string {
  if (bps >= 1000000) return `${(bps / 1000000).toFixed(2)} Mbps`;
  if (bps >= 1000) return `${(bps / 1000).toFixed(0)} Kbps`;
  return `${bps} bps`;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs.toFixed(0)}s`;
}

export const StatsOverlay = memo(function StatsOverlay({
  isOpen,
  onClose,
  className,
}: StatsOverlayProps) {
  const [stats, setStats] = useState<PlaybackStats | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const intervalRef = useRef<number | null>(null);
  const stallCountRef = useRef(0);
  const fragmentCountRef = useRef(0);

  const updateStats = useCallback(() => {
    const hls = hlsRef.current;
    const video = videoRef.current;
    
    if (!video) return;

    const newStats: PlaybackStats = {
      // Video
      resolution: `${video.videoWidth}x${video.videoHeight}`,
      fps: 0,
      codec: '',
      
      // Network
      bandwidth: 0,
      estimatedBandwidth: 0,
      downloadSpeed: 0,
      
      // Buffer
      bufferLength: 0,
      bufferSize: 0,
      bufferStalls: stallCountRef.current,
      
      // Latency
      latency: 0,
      liveEdge: 0,
      
      // Quality
      currentLevel: -1,
      maxLevel: 0,
      levelBitrate: 0,
      
      // Fragments
      fragmentsLoaded: fragmentCountRef.current,
      fragmentDuration: 0,
      
      // Playback
      currentTime: video.currentTime,
      duration: video.duration || 0,
      playbackRate: video.playbackRate,
      dropped: 0,
    };

    // Buffer calculation
    if (video.buffered.length > 0) {
      newStats.bufferLength = video.buffered.end(video.buffered.length - 1) - video.currentTime;
    }

    // Dropped frames (if available)
    if ('getVideoPlaybackQuality' in video) {
      const quality = (video as any).getVideoPlaybackQuality();
      newStats.dropped = quality.droppedVideoFrames || 0;
      if (quality.totalVideoFrames > 0 && video.currentTime > 0) {
        newStats.fps = Math.round(quality.totalVideoFrames / video.currentTime);
      }
    }

    // HLS-specific stats
    if (hls) {
      // Bandwidth
      newStats.bandwidth = hls.bandwidthEstimate || 0;
      newStats.estimatedBandwidth = hls.bandwidthEstimate || 0;
      
      // Current level
      newStats.currentLevel = hls.currentLevel;
      newStats.maxLevel = hls.levels?.length - 1 || 0;
      
      // Level bitrate
      const currentLevelData = hls.levels?.[hls.currentLevel];
      if (currentLevelData) {
        newStats.levelBitrate = currentLevelData.bitrate || 0;
        newStats.codec = currentLevelData.videoCodec || currentLevelData.audioCodec || '';
      }
      
      // Latency for live
      if (hls.liveSyncPosition) {
        newStats.liveEdge = hls.liveSyncPosition;
        newStats.latency = hls.liveSyncPosition - video.currentTime;
      }
    }

    setStats(newStats);
  }, []);

  // Expose attach methods via window for external use
  useEffect(() => {
    (window as any).__statsOverlay = {
      attachHls: (hls: Hls) => {
        hlsRef.current = hls;
        
        hls.on(Hls.Events.FRAG_LOADED, () => {
          fragmentCountRef.current++;
        });
        
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.details === 'bufferStalledError') {
            stallCountRef.current++;
          }
        });
      },
      attachVideo: (video: HTMLVideoElement) => {
        videoRef.current = video;
        
        video.addEventListener('stalled', () => {
          stallCountRef.current++;
        });
      },
    };

    return () => {
      delete (window as any).__statsOverlay;
    };
  }, []);

  // Start/stop update interval
  useEffect(() => {
    if (isOpen) {
      updateStats();
      intervalRef.current = window.setInterval(updateStats, 500);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isOpen, updateStats]);

  if (!isOpen) return null;

  return (
    <div 
      className={cn(
        'absolute top-4 left-4 z-50 bg-black/90 text-white text-xs font-mono',
        'rounded-lg p-3 min-w-[280px] max-w-[320px] backdrop-blur-sm',
        'border border-white/10',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-green-400" />
          <span className="font-semibold">Stats for Nerds</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {stats ? (
        <div className="space-y-2.5">
          {/* Video Info */}
          <StatSection icon={Video} label="Video">
            <StatRow label="Resolution" value={stats.resolution} />
            {stats.fps > 0 && <StatRow label="FPS" value={`${stats.fps}`} />}
            {stats.codec && <StatRow label="Codec" value={stats.codec} />}
            {stats.dropped > 0 && (
              <StatRow label="Dropped" value={`${stats.dropped}`} warning />
            )}
          </StatSection>

          {/* Network */}
          <StatSection icon={Wifi} label="Network">
            <StatRow label="Bandwidth" value={formatBitrate(stats.bandwidth)} />
            <StatRow label="Level Bitrate" value={formatBitrate(stats.levelBitrate)} />
            <StatRow label="Quality" value={`${stats.currentLevel + 1}/${stats.maxLevel + 1}`} />
          </StatSection>

          {/* Buffer */}
          <StatSection icon={HardDrive} label="Buffer">
            <StatRow label="Length" value={`${stats.bufferLength.toFixed(1)}s`} />
            {stats.bufferStalls > 0 && (
              <StatRow label="Stalls" value={`${stats.bufferStalls}`} warning />
            )}
            <StatRow label="Fragments" value={`${stats.fragmentsLoaded}`} />
          </StatSection>

          {/* Latency (only for live) */}
          {stats.latency > 0 && (
            <StatSection icon={Clock} label="Latency">
              <StatRow label="Current" value={`${stats.latency.toFixed(1)}s`} />
              <StatRow label="Live Edge" value={formatTime(stats.liveEdge)} />
            </StatSection>
          )}

          {/* Playback */}
          <StatSection icon={Gauge} label="Playback">
            <StatRow label="Position" value={formatTime(stats.currentTime)} />
            {stats.duration > 0 && !isNaN(stats.duration) && (
              <StatRow label="Duration" value={formatTime(stats.duration)} />
            )}
            {stats.playbackRate !== 1 && (
              <StatRow label="Speed" value={`${stats.playbackRate}x`} />
            )}
          </StatSection>
        </div>
      ) : (
        <div className="text-center text-white/50 py-4">
          Carregando estatísticas...
        </div>
      )}
    </div>
  );
});

// Helper components
function StatSection({ 
  icon: Icon, 
  label, 
  children 
}: { 
  icon: React.ElementType; 
  label: string; 
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-white/60 mb-1">
        <Icon className="w-3 h-3" />
        <span className="uppercase text-[10px]">{label}</span>
      </div>
      <div className="pl-4 space-y-0.5">{children}</div>
    </div>
  );
}

function StatRow({ 
  label, 
  value, 
  warning 
}: { 
  label: string; 
  value: string; 
  warning?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-white/50">{label}</span>
      <span className={warning ? 'text-yellow-400' : 'text-white'}>{value}</span>
    </div>
  );
}

export default StatsOverlay;
