/**
 * ============================================================================
 * VirtualChannelGrid - Virtualized Channel Grid for Performance
 * ============================================================================
 * 
 * Uses @tanstack/react-virtual for efficient rendering of large channel lists.
 * Only renders items visible in viewport + buffer.
 */

import { useRef, useMemo, memo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';
import { TVContentCard } from './TVContentCard';
import { Loader2 } from 'lucide-react';

interface Channel {
  id: string;
  name: string;
  tvg_logo?: string;
  category_name?: string;
}

interface VirtualChannelGridProps {
  channels: Channel[];
  isFavorite: (id: string) => boolean;
  onPlay: (channel: Channel) => void;
  onToggleFavorite: (id: string) => void;
  emptyMessage?: string;
  className?: string;
  /** Number of columns based on screen size */
  columns?: number;
  /** Estimated row height for virtualization */
  estimatedRowHeight?: number;
}

// Memoized channel card for optimal performance
const MemoizedChannelCard = memo(function MemoizedChannelCard({
  channel,
  isFavorite,
  onPlay,
  onToggleFavorite,
}: {
  channel: Channel;
  isFavorite: boolean;
  onPlay: () => void;
  onToggleFavorite: () => void;
}) {
  return (
    <TVContentCard
      id={channel.id}
      name={channel.name}
      logo={channel.tvg_logo}
      category={channel.category_name}
      isFavorite={isFavorite}
      onPlay={onPlay}
      onToggleFavorite={onToggleFavorite}
      fillContainer
    />
  );
});

export const VirtualChannelGrid = memo(function VirtualChannelGrid({
  channels,
  isFavorite,
  onPlay,
  onToggleFavorite,
  emptyMessage = "Nenhum conteúdo encontrado",
  className,
  columns = 5,
  estimatedRowHeight = 280,
}: VirtualChannelGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Group channels into rows
  const rows = useMemo(() => {
    const result: Channel[][] = [];
    for (let i = 0; i < channels.length; i += columns) {
      result.push(channels.slice(i, i + columns));
    }
    return result;
  }, [channels, columns]);

  // Virtual row renderer
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimatedRowHeight,
    overscan: 3, // Render 3 extra rows above/below viewport
  });

  const virtualRows = rowVirtualizer.getVirtualItems();

  // Callbacks with stable references
  const handlePlay = useCallback((channel: Channel) => {
    onPlay(channel);
  }, [onPlay]);

  const handleToggleFavorite = useCallback((id: string) => {
    onToggleFavorite(id);
  }, [onToggleFavorite]);

  if (channels.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] px-4 lg:px-8">
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <section className={cn("py-4 lg:py-6", className)}>
      {/* Results count */}
      <div className="px-4 lg:px-8 mb-3 lg:mb-4">
        <p className="text-sm text-muted-foreground">
          {channels.length.toLocaleString()} itens
        </p>
      </div>

      {/* Virtualized Grid Container */}
      <div
        ref={parentRef}
        className="h-[calc(100vh-200px)] overflow-auto px-4 lg:px-8"
        style={{
          contain: 'strict',
        }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualRows.map((virtualRow) => {
            const row = rows[virtualRow.index];
            return (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-6">
                  {row.map((channel) => (
                    <MemoizedChannelCard
                      key={channel.id}
                      channel={channel}
                      isFavorite={isFavorite(channel.id)}
                      onPlay={() => handlePlay(channel)}
                      onToggleFavorite={() => handleToggleFavorite(channel.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Loading indicator for scroll */}
      {rowVirtualizer.isScrolling && (
        <div className="fixed bottom-4 right-4 bg-card/80 backdrop-blur-sm rounded-full p-2 shadow-lg">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      )}
    </section>
  );
});

export default VirtualChannelGrid;
