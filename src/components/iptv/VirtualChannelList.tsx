/**
 * ============================================================================
 * VirtualChannelList - Virtualized Vertical Channel List
 * ============================================================================
 * 
 * Optimized for sidebar/overlay channel lists with thousands of items.
 * Uses @tanstack/react-virtual for smooth scrolling.
 */

import { useRef, memo, useCallback, forwardRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';
import { Play, Heart, Zap } from 'lucide-react';

interface Channel {
  id: string;
  name: string;
  tvg_logo?: string;
  category_name?: string;
  stream_url?: string;
}

interface VirtualChannelListProps {
  channels: Channel[];
  currentChannelId?: string;
  isFavorite?: (id: string) => boolean;
  isPreloaded?: (id: string) => boolean;
  onSelectChannel: (channel: Channel) => void;
  onHover?: (channel: Channel) => void;
  getChannelNumber?: (channel: Channel) => number | null;
  className?: string;
  itemHeight?: number;
}

// Memoized channel item for optimal performance
const ChannelItem = memo(function ChannelItem({
  channel,
  isActive,
  isFavorite,
  isPreloaded,
  channelNumber,
  onSelect,
  onHover,
}: {
  channel: Channel;
  isActive: boolean;
  isFavorite: boolean;
  isPreloaded: boolean;
  channelNumber: number | null;
  onSelect: () => void;
  onHover?: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      onMouseEnter={onHover}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all",
        "hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-primary",
        isActive && "bg-primary/20 border-l-2 border-primary"
      )}
    >
      {/* Channel Number */}
      {channelNumber !== null && (
        <span className="text-xs font-mono text-muted-foreground w-8 text-right">
          {channelNumber}
        </span>
      )}

      {/* Logo */}
      <div className="w-10 h-10 rounded bg-muted flex-shrink-0 overflow-hidden">
        {channel.tvg_logo ? (
          <img
            src={channel.tvg_logo}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Play className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 text-left">
        <p className={cn(
          "text-sm font-medium truncate",
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

      {/* Badges */}
      <div className="flex items-center gap-1">
        {isPreloaded && (
          <span title="Pré-carregado">
            <Zap className="w-3.5 h-3.5 text-yellow-500" />
          </span>
        )}
        {isFavorite && (
          <Heart className="w-3.5 h-3.5 text-red-500 fill-current" />
        )}
      </div>
    </button>
  );
});

export const VirtualChannelList = memo(forwardRef<HTMLDivElement, VirtualChannelListProps>(
  function VirtualChannelList({
    channels,
    currentChannelId,
    isFavorite = () => false,
    isPreloaded = () => false,
    onSelectChannel,
    onHover,
    getChannelNumber,
    className,
    itemHeight = 56,
  }, ref) {
    const parentRef = useRef<HTMLDivElement>(null);

    const virtualizer = useVirtualizer({
      count: channels.length,
      getScrollElement: () => parentRef.current,
      estimateSize: () => itemHeight,
      overscan: 10, // Render 10 extra items above/below
    });

    const virtualItems = virtualizer.getVirtualItems();

    // Stable callback references
    const handleSelect = useCallback((channel: Channel) => {
      onSelectChannel(channel);
    }, [onSelectChannel]);

    const handleHover = useCallback((channel: Channel) => {
      onHover?.(channel);
    }, [onHover]);

    if (channels.length === 0) {
      return (
        <div className={cn("flex items-center justify-center py-8", className)}>
          <p className="text-sm text-muted-foreground">Nenhum canal encontrado</p>
        </div>
      );
    }

    return (
      <div
        ref={(node) => {
          (parentRef as any).current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        className={cn("h-full overflow-auto", className)}
        style={{ contain: 'strict' }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualItems.map((virtualItem) => {
            const channel = channels[virtualItem.index];
            return (
              <div
                key={virtualItem.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <ChannelItem
                  channel={channel}
                  isActive={channel.id === currentChannelId}
                  isFavorite={isFavorite(channel.id)}
                  isPreloaded={isPreloaded(channel.id)}
                  channelNumber={getChannelNumber?.(channel) ?? null}
                  onSelect={() => handleSelect(channel)}
                  onHover={() => handleHover(channel)}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }
));

export default VirtualChannelList;
