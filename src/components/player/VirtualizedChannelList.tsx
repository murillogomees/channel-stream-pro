/**
 * Virtualized Channel List Component
 * 
 * Renders large channel lists (200k+) efficiently using virtual scrolling.
 * Only renders visible items + small buffer.
 */

import React, { useRef, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';
import { Tv, Radio, Film, Loader2 } from 'lucide-react';

interface Channel {
  id: string;
  name: string;
  stream_url: string;
  tvg_logo: string | null;
  tvg_id: string | null;
  category_id: string;
  category_name?: string;
  order_position: number;
}

interface VirtualizedChannelListProps {
  channels: Channel[];
  selectedChannelId?: string;
  onChannelSelect: (channel: Channel) => void;
  isLoading?: boolean;
  className?: string;
  itemHeight?: number;
  overscan?: number;
}

export const VirtualizedChannelList: React.FC<VirtualizedChannelListProps> = ({
  channels,
  selectedChannelId,
  onChannelSelect,
  isLoading = false,
  className,
  itemHeight = 56,
  overscan = 5,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: channels.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight,
    overscan,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Scroll to selected channel
  const scrollToChannel = useCallback((channelId: string) => {
    const index = channels.findIndex(c => c.id === channelId);
    if (index >= 0) {
      virtualizer.scrollToIndex(index, { align: 'center' });
    }
  }, [channels, virtualizer]);

  // Get icon based on channel type
  const getChannelIcon = useCallback((channel: Channel) => {
    const name = channel.name.toLowerCase();
    if (name.includes('radio') || name.includes('fm ') || name.includes('am ')) {
      return <Radio className="h-4 w-4 text-muted-foreground" />;
    }
    if (name.includes('filme') || name.includes('movie') || name.includes('cinema')) {
      return <Film className="h-4 w-4 text-muted-foreground" />;
    }
    return <Tv className="h-4 w-4 text-muted-foreground" />;
  }, []);

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full text-muted-foreground", className)}>
        <Tv className="h-12 w-12 mb-2 opacity-50" />
        <p>Nenhum canal encontrado</p>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={cn(
        "h-full overflow-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent",
        className
      )}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualRow) => {
          const channel = channels[virtualRow.index];
          const isSelected = channel.id === selectedChannelId;

          return (
            <div
              key={channel.id}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <button
                onClick={() => onChannelSelect(channel)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 text-left transition-colors",
                  "hover:bg-accent/50 focus:bg-accent/50 focus:outline-none",
                  isSelected && "bg-primary/20 border-l-2 border-primary"
                )}
              >
                {/* Channel Logo or Icon */}
                <div className="flex-shrink-0 w-10 h-10 rounded bg-muted flex items-center justify-center overflow-hidden">
                  {channel.tvg_logo ? (
                    <img
                      src={channel.tvg_logo}
                      alt=""
                      className="w-full h-full object-contain"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    getChannelIcon(channel)
                  )}
                </div>

                {/* Channel Info */}
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm font-medium truncate",
                    isSelected ? "text-primary" : "text-foreground"
                  )}>
                    {channel.name}
                  </p>
                  {channel.category_name && (
                    <p className="text-xs text-muted-foreground truncate">
                      {channel.category_name}
                    </p>
                  )}
                </div>

                {/* Channel Number */}
                <div className="flex-shrink-0 text-xs text-muted-foreground tabular-nums">
                  {virtualRow.index + 1}
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Memoized version for performance
export const MemoizedVirtualizedChannelList = React.memo(VirtualizedChannelList);
