/**
 * ============================================================================
 * QualitySelector - UI Component for Quality Selection
 * ============================================================================
 */

import { memo, useState } from 'react';
import { Settings, Check, Wifi, Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { 
  QualityLevel, 
  ABRStats, 
  ABRMode,
  getQualityBadge,
  formatBitrate,
} from '@/services/abrService';

interface QualitySelectorProps {
  levels: QualityLevel[];
  currentLevel: QualityLevel | null;
  mode: ABRMode;
  stats?: ABRStats | null;
  onSelectLevel: (index: number) => void;
  className?: string;
  showStats?: boolean;
  disabled?: boolean;
}

export const QualitySelector = memo(function QualitySelector({
  levels,
  currentLevel,
  mode,
  stats,
  onSelectLevel,
  className,
  showStats = false,
  disabled = false,
}: QualitySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Get display label
  const getDisplayLabel = () => {
    if (!currentLevel) return 'Auto';
    if (mode === 'auto') {
      // Show auto with current resolution
      const actualLevel = levels.find(l => !l.isAuto && l.bitrate === currentLevel.bitrate);
      return actualLevel ? `Auto (${actualLevel.label})` : 'Auto';
    }
    return currentLevel.label;
  };

  // Get quality badge color
  const getBadgeColor = () => {
    if (!currentLevel || mode === 'auto') return 'bg-primary';
    const badge = getQualityBadge(currentLevel.height);
    return badge.color;
  };

  if (levels.length <= 1) {
    return null; // No quality options available
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button 
          variant="ghost" 
          size="sm"
          className={cn(
            'flex items-center gap-2 px-3 py-1.5',
            'bg-background/20 hover:bg-background/40 text-foreground',
            className
          )}
        >
          <Settings className="w-4 h-4" />
          <span className="text-sm font-medium">{getDisplayLabel()}</span>
          {currentLevel && !currentLevel.isAuto && (
            <span className={cn('w-2 h-2 rounded-full', getBadgeColor())} />
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent 
        align="end" 
        className="w-64 bg-background/95 backdrop-blur-md border-border"
      >
        <DropdownMenuLabel className="flex items-center gap-2">
          <Gauge className="w-4 h-4" />
          Qualidade
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />

        {/* Quality levels */}
        {levels.map((level) => {
          const isSelected = mode === 'auto' 
            ? level.isAuto 
            : currentLevel?.index === level.index;
          
          const badge = !level.isAuto ? getQualityBadge(level.height) : null;

          return (
            <DropdownMenuItem
              key={level.isAuto ? 'auto' : level.index}
              onClick={() => onSelectLevel(level.index)}
              className={cn(
                'flex items-center justify-between cursor-pointer',
                isSelected && 'bg-primary/10'
              )}
            >
              <div className="flex items-center gap-3">
                {isSelected ? (
                  <Check className="w-4 h-4 text-primary" />
                ) : (
                  <div className="w-4 h-4" />
                )}
                
                <div className="flex flex-col">
                  <span className="font-medium">
                    {level.isAuto ? 'Automático' : level.label}
                  </span>
                  {!level.isAuto && (
                    <span className="text-xs text-muted-foreground">
                      {formatBitrate(level.bitrate)} • {level.width}×{level.height}
                    </span>
                  )}
                  {level.isAuto && (
                    <span className="text-xs text-muted-foreground">
                      Ajuste baseado na conexão
                    </span>
                  )}
                </div>
              </div>

              {badge && (
                <span className={cn(
                  'text-xs px-1.5 py-0.5 rounded text-white',
                  badge.color
                )}>
                  {badge.label}
                </span>
              )}
            </DropdownMenuItem>
          );
        })}

        {/* Stats section */}
        {showStats && stats && (
          <>
            <DropdownMenuSeparator />
            <div className="p-2 space-y-1.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Wifi className="w-3 h-3" />
                <span>Bandwidth: {formatBitrate(stats.estimatedBandwidth)}</span>
              </div>
              <div className="flex justify-between">
                <span>Buffer: {stats.bufferLength.toFixed(1)}s</span>
                <span>Trocas: {stats.qualityChanges}</span>
              </div>
              {stats.droppedFrames > 0 && (
                <div className="text-yellow-500">
                  Frames perdidos: {stats.droppedFrames}
                </div>
              )}
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

export default QualitySelector;
