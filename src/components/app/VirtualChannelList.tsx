/**
 * VirtualChannelList - High-performance virtualized channel list
 * 
 * Uses @tanstack/react-virtual for efficient rendering of 200k+ items
 * Only renders visible items in the viewport
 */

import { memo, useCallback, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';
import { Tv, Radio, Star } from 'lucide-react';

interface Channel {
  id: string;
  name: string;
  stream_url: string;
  tvg_logo?: string;
  category_name?: string;
  category_id?: string;
}

interface VirtualChannelListProps {
  channels: Channel[];
  currentChannelId?: string;
  onChannelSelect: (channel: Channel) => void;
  onFavoriteToggle?: (channelId: string) => void;
  isFavorite?: (channelId: string) => boolean;
  className?: string;
  itemHeight?: number;
}

// Memoized channel item - prevents re-renders
const ChannelItem = memo(function ChannelItem({
  channel,
  isActive,
  isFav,
  onSelect,
  onFavoriteToggle,
  style,
}: {
  channel: Channel;
  isActive: boolean;
  isFav: boolean;
  onSelect: () => void;
  onFavoriteToggle?: () => void;
  style: React.CSSProperties;
}) {
  const handleFavoriteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onFavoriteToggle?.();
  }, [onFavoriteToggle]);

  return (
    <div
      style={style}
      className="px-2"
    >
      <button
        onClick={onSelect}
        className={cn(
          "w-full flex items-center gap-3 p-2 sm:p-3 rounded-lg transition-colors text-left",
          "hover:bg-accent/50 active:bg-accent/70",
          isActive && "bg-primary/10 border border-primary/20"
        )}
      >
        {/* Channel logo */}
        <div className="relative flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12">
          {channel.tvg_logo ? (
            <img
              src={channel.tvg_logo}
              alt=""
              className="w-full h-full rounded-lg object-contain bg-muted"
              loading="lazy"
              decoding="async"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <div className={cn(
            "w-full h-full rounded-lg bg-muted flex items-center justify-center",
            channel.tvg_logo && "hidden"
          )}>
            <Tv className="w-5 h-5 text-muted-foreground" />
          </div>
        </div>

        {/* Channel info */}
        <div className="flex-1 min-w-0">
          <p className={cn(
            "font-medium truncate text-sm sm:text-base",
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

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {onFavoriteToggle && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleFavoriteClick}
              onKeyDown={(e) => e.key === 'Enter' && handleFavoriteClick(e as any)}
              className={cn(
                "p-1.5 rounded-full transition-colors cursor-pointer",
                isFav 
                  ? "text-yellow-500 hover:text-yellow-600" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Star className={cn("w-4 h-4", isFav && "fill-current")} />
            </span>
          )}
          
          {isActive && (
            <div className="flex items-center gap-1 text-xs text-red-500">
              <Radio className="w-3 h-3 animate-pulse" />
            </div>
          )}
        </div>
      </button>
    </div>
  );
});

export const VirtualChannelList = memo(function VirtualChannelList({
  channels,
  currentChannelId,
  onChannelSelect,
  onFavoriteToggle,
  isFavorite,
  className,
  itemHeight = 64,
}: VirtualChannelListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Create stable channel map for quick lookup
  const channelMap = useMemo(() => {
    const map = new Map<string, Channel>();
    channels.forEach(ch => map.set(ch.id, ch));
    return map;
  }, [channels]);

  // Virtualizer - only renders visible items
  const virtualizer = useVirtualizer({
    count: channels.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight,
    overscan: 10, // Render 10 extra items above/below viewport
  });

  // Stable callbacks
  const createSelectHandler = useCallback((channel: Channel) => {
    return () => onChannelSelect(channel);
  }, [onChannelSelect]);

  const createFavoriteHandler = useCallback((channelId: string) => {
    return () => onFavoriteToggle?.(channelId);
  }, [onFavoriteToggle]);

  const items = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className={cn(
        "h-full overflow-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent",
        className
      )}
    >
      {/* Empty state */}
      {channels.length === 0 && (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <p>Nenhum canal encontrado</p>
        </div>
      )}

      {/* Virtual list container */}
      {channels.length > 0 && (
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {items.map((virtualItem) => {
            const channel = channels[virtualItem.index];
            if (!channel) return null;

            return (
              <ChannelItem
                key={channel.id}
                channel={channel}
                isActive={channel.id === currentChannelId}
                isFav={isFavorite?.(channel.id) ?? false}
                onSelect={createSelectHandler(channel)}
                onFavoriteToggle={
                  onFavoriteToggle ? createFavoriteHandler(channel.id) : undefined
                }
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
});

export default VirtualChannelList;
