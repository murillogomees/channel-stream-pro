/**
 * OptimizedChannelList - Memoized channel list component
 * 
 * Prevents unnecessary re-renders during video playback
 */

import { memo, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Tv, Radio, CheckCircle2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Channel {
  id: string;
  name: string;
  stream_url: string;
  tvg_logo?: string;
  category_name?: string;
}

interface OptimizedChannelListProps {
  channels: Channel[];
  currentChannelId?: string;
  preloadedChannels?: Set<string>;
  onChannelSelect: (channel: Channel) => void;
  className?: string;
}

// Memoized channel item to prevent re-renders
const ChannelItem = memo(function ChannelItem({
  channel,
  isActive,
  isPreloaded,
  onSelect,
}: {
  channel: Channel;
  isActive: boolean;
  isPreloaded: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left",
        "hover:bg-accent/50",
        isActive && "bg-primary/10 border border-primary/20"
      )}
    >
      {/* Channel logo */}
      <div className="relative flex-shrink-0">
        {channel.tvg_logo ? (
          <img
            src={channel.tvg_logo}
            alt=""
            className="w-10 h-10 rounded-lg object-contain bg-muted"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        <div className={cn(
          "w-10 h-10 rounded-lg bg-muted flex items-center justify-center",
          channel.tvg_logo && "hidden"
        )}>
          <Tv className="w-5 h-5 text-muted-foreground" />
        </div>
        
        {/* Preloaded indicator */}
        {isPreloaded && !isActive && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-3 h-3 text-white" />
          </div>
        )}
      </div>

      {/* Channel info */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "font-medium truncate",
          isActive && "text-primary"
        )}>
          {channel.name}
        </p>
        {channel.category_name && (
          <p className="text-xs text-muted-foreground truncate">
            {channel.category_name}
          </p>
        )}
      </div>

      {/* Active indicator */}
      {isActive && (
        <div className="flex items-center gap-1 text-xs text-red-500">
          <Radio className="w-3 h-3 animate-pulse" />
          <span>AO VIVO</span>
        </div>
      )}
    </button>
  );
});

export const OptimizedChannelList = memo(function OptimizedChannelList({
  channels,
  currentChannelId,
  preloadedChannels = new Set(),
  onChannelSelect,
  className,
}: OptimizedChannelListProps) {
  // Memoize channel selection handler factory
  const createSelectHandler = useCallback((channel: Channel) => {
    return () => onChannelSelect(channel);
  }, [onChannelSelect]);

  // Group channels by category for better organization
  const groupedChannels = useMemo(() => {
    const groups = new Map<string, Channel[]>();
    
    channels.forEach(channel => {
      const category = channel.category_name || 'Outros';
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(channel);
    });
    
    return groups;
  }, [channels]);

  return (
    <ScrollArea className={cn("h-full", className)}>
      <div className="p-2 space-y-4">
        {Array.from(groupedChannels.entries()).map(([category, categoryChannels]) => (
          <div key={category}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">
              {category}
            </h3>
            <div className="space-y-1">
              {categoryChannels.map(channel => (
                <ChannelItem
                  key={channel.id}
                  channel={channel}
                  isActive={channel.id === currentChannelId}
                  isPreloaded={preloadedChannels.has(channel.id)}
                  onSelect={createSelectHandler(channel)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
});

export default OptimizedChannelList;
