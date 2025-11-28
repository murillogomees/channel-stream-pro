/**
 * ChannelOSD - On Screen Display for channel info during zapping
 */

import { memo, useEffect, useState } from 'react';
import { Tv, Clock, Star, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { EPGStrip } from './EPGStrip';
import type { EPGProgram } from '../types';

interface Channel {
  id: string;
  name: string;
  tvg_logo?: string;
  category_name?: string;
}

interface ChannelOSDProps {
  channel: Channel;
  channelNumber: number | null;
  totalChannels: number;
  numberInput?: string;
  currentProgram?: EPGProgram;
  nextProgram?: EPGProgram;
  progress?: number;
  timeRemaining?: string;
  isVisible: boolean;
  className?: string;
}

export const ChannelOSD = memo(function ChannelOSD({
  channel,
  channelNumber,
  totalChannels,
  numberInput,
  currentProgram,
  nextProgram,
  progress,
  timeRemaining,
  isVisible,
  className,
}: ChannelOSDProps) {
  const [show, setShow] = useState(false);

  // Animate entrance/exit
  useEffect(() => {
    if (isVisible) {
      setShow(true);
    } else {
      const timeout = setTimeout(() => setShow(false), 300);
      return () => clearTimeout(timeout);
    }
  }, [isVisible]);

  if (!show) return null;

  return (
    <div
      className={cn(
        'fixed bottom-20 left-4 right-4 md:left-8 md:right-auto md:max-w-md z-50',
        'transition-all duration-300 ease-out',
        isVisible 
          ? 'opacity-100 translate-y-0' 
          : 'opacity-0 translate-y-4 pointer-events-none',
        className
      )}
    >
      <div className="bg-background/95 backdrop-blur-xl rounded-xl border border-border shadow-2xl overflow-hidden">
        {/* Channel Info Header */}
        <div className="p-4 flex items-center gap-4">
          {/* Channel Logo */}
          <div className="w-16 h-16 flex-shrink-0 rounded-lg bg-muted overflow-hidden">
            {channel.tvg_logo ? (
              <img
                src={channel.tvg_logo}
                alt={channel.name}
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Tv className="w-8 h-8 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Channel Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {/* Channel Number */}
              {channelNumber && (
                <span className="px-2 py-0.5 bg-primary text-primary-foreground text-sm font-bold rounded">
                  {channelNumber}
                </span>
              )}
              {/* Category */}
              {channel.category_name && (
                <span className="text-xs text-muted-foreground">
                  {channel.category_name}
                </span>
              )}
            </div>
            
            {/* Channel Name */}
            <h3 className="text-lg font-bold text-foreground truncate">
              {channel.name}
            </h3>
            
            {/* Total channels indicator */}
            <p className="text-xs text-muted-foreground">
              Canal {channelNumber || '?'} de {totalChannels}
            </p>
          </div>
        </div>

        {/* EPG Info */}
        {(currentProgram || nextProgram) && (
          <div className="px-4 pb-4">
            <EPGStrip
              currentProgram={currentProgram}
              nextProgram={nextProgram}
              progress={progress}
              timeRemaining={timeRemaining}
              className="bg-muted/50"
            />
          </div>
        )}

        {/* Number Input Display */}
        {numberInput && (
          <div className="px-4 pb-4">
            <div className="flex items-center justify-center gap-1 py-2 bg-muted rounded-lg">
              <span className="text-2xl font-mono font-bold text-primary">
                {numberInput}
              </span>
              <span className="animate-pulse text-2xl text-muted-foreground">_</span>
            </div>
          </div>
        )}

        {/* Controls Hint */}
        <div className="px-4 py-2 bg-muted/30 border-t border-border">
          <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <span>▲▼ Canais</span>
            <span>⌫ Voltar</span>
            <span>0-9 Ir para</span>
          </div>
        </div>
      </div>
    </div>
  );
});
