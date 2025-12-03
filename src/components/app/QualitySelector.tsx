/**
 * QualitySelector - Manual Quality Selection UI
 * 
 * Permite usuário escolher qualidade manualmente (Auto/1080p/720p/480p)
 */

import { memo, useState, useEffect, useCallback } from 'react';
import { Settings, Check, Wifi, WifiOff, Signal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface QualityLevel {
  index: number;
  height: number;
  width: number;
  bitrate: number;
  label: string;
}

interface QualitySelectorProps {
  levels: QualityLevel[];
  currentLevel: number;
  autoLevel: boolean;
  networkQuality?: 'poor' | 'fair' | 'good' | 'excellent';
  onLevelChange: (level: number) => void; // -1 for auto
  className?: string;
}

const formatBitrate = (bitrate: number): string => {
  if (bitrate >= 1000000) {
    return `${(bitrate / 1000000).toFixed(1)} Mbps`;
  }
  return `${Math.round(bitrate / 1000)} Kbps`;
};

const getQualityLabel = (height: number): string => {
  if (height >= 2160) return '4K';
  if (height >= 1440) return '1440p';
  if (height >= 1080) return '1080p';
  if (height >= 720) return '720p';
  if (height >= 480) return '480p';
  if (height >= 360) return '360p';
  return `${height}p`;
};

const getNetworkIcon = (quality?: string) => {
  switch (quality) {
    case 'excellent': return <Signal className="w-4 h-4 text-green-500" />;
    case 'good': return <Wifi className="w-4 h-4 text-green-400" />;
    case 'fair': return <Wifi className="w-4 h-4 text-yellow-500" />;
    case 'poor': return <WifiOff className="w-4 h-4 text-red-500" />;
    default: return <Wifi className="w-4 h-4" />;
  }
};

export const QualitySelector = memo(function QualitySelector({
  levels,
  currentLevel,
  autoLevel,
  networkQuality,
  onLevelChange,
  className,
}: QualitySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Sort levels by height (highest first)
  const sortedLevels = [...levels].sort((a, b) => b.height - a.height);

  // Get current quality label
  const currentQualityLabel = autoLevel 
    ? 'Auto' 
    : (sortedLevels.find(l => l.index === currentLevel)?.label || 'Auto');

  const handleSelectLevel = useCallback((level: number) => {
    onLevelChange(level);
    setIsOpen(false);
  }, [onLevelChange]);

  if (levels.length <= 1) {
    return null; // Don't show selector if only one quality
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "text-white hover:bg-white/20 gap-2",
            className
          )}
        >
          <Settings className="w-4 h-4" />
          <span className="text-xs">{currentQualityLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-56 bg-black/95 border-white/20"
      >
        <DropdownMenuLabel className="flex items-center justify-between text-white/70">
          <span>Qualidade</span>
          {networkQuality && (
            <div className="flex items-center gap-1 text-xs">
              {getNetworkIcon(networkQuality)}
              <span className="capitalize">{networkQuality}</span>
            </div>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />
        
        {/* Auto option */}
        <DropdownMenuItem
          onClick={() => handleSelectLevel(-1)}
          className={cn(
            "text-white cursor-pointer hover:bg-white/10",
            autoLevel && "bg-white/20"
          )}
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Signal className="w-4 h-4" />
              <span>Automático</span>
            </div>
            {autoLevel && <Check className="w-4 h-4" />}
          </div>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator className="bg-white/10" />
        
        {/* Quality levels */}
        {sortedLevels.map((level) => (
          <DropdownMenuItem
            key={level.index}
            onClick={() => handleSelectLevel(level.index)}
            className={cn(
              "text-white cursor-pointer hover:bg-white/10",
              !autoLevel && currentLevel === level.index && "bg-white/20"
            )}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex flex-col">
                <span className="font-medium">{level.label}</span>
                <span className="text-xs text-white/50">
                  {level.width}x{level.height} • {formatBitrate(level.bitrate)}
                </span>
              </div>
              {!autoLevel && currentLevel === level.index && (
                <Check className="w-4 h-4" />
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

/**
 * Hook to extract quality levels from HLS.js instance
 */
export function useQualityLevels(hls: any) {
  const [levels, setLevels] = useState<QualityLevel[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [autoLevel, setAutoLevel] = useState(true);

  useEffect(() => {
    if (!hls) return;

    const updateLevels = () => {
      if (hls.levels && hls.levels.length > 0) {
        const qualityLevels: QualityLevel[] = hls.levels.map((level: any, index: number) => ({
          index,
          height: level.height || 0,
          width: level.width || 0,
          bitrate: level.bitrate || 0,
          label: getQualityLabel(level.height || 0),
        }));
        setLevels(qualityLevels);
      }
    };

    const updateCurrentLevel = (_: any, data: any) => {
      setCurrentLevel(data.level);
    };

    const handleAutoLevelChange = () => {
      setAutoLevel(hls.autoLevelEnabled !== false && hls.currentLevel === -1);
    };

    // Listen for level changes
    hls.on('hlsManifestParsed', updateLevels);
    hls.on('hlsLevelSwitched', updateCurrentLevel);
    hls.on('hlsLevelSwitching', handleAutoLevelChange);

    // Initial state
    updateLevels();
    setCurrentLevel(hls.currentLevel);
    setAutoLevel(hls.autoLevelEnabled !== false);

    return () => {
      hls.off('hlsManifestParsed', updateLevels);
      hls.off('hlsLevelSwitched', updateCurrentLevel);
      hls.off('hlsLevelSwitching', handleAutoLevelChange);
    };
  }, [hls]);

  const setLevel = useCallback((level: number) => {
    if (!hls) return;
    
    if (level === -1) {
      // Enable auto
      hls.currentLevel = -1;
      hls.nextLevel = -1;
      setAutoLevel(true);
    } else {
      // Set specific level
      hls.currentLevel = level;
      hls.nextLevel = level;
      setAutoLevel(false);
    }
    setCurrentLevel(level);
  }, [hls]);

  return {
    levels,
    currentLevel,
    autoLevel,
    setLevel,
  };
}

export default QualitySelector;
