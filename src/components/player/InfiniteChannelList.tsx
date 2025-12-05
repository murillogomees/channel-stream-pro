/**
 * Infinite Channel List Component
 * 
 * High-performance virtualized channel list with:
 * - Support for 200k+ channels
 * - Infinite scroll with batch fetching
 * - Lazy loading of logos
 * - Search/filter without freezing UI
 * - Sticky group headers
 * - Keyboard navigation
 */

import React, { useRef, useCallback, useMemo, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useVirtualizer, VirtualItem } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';
import { Search, RefreshCw, Filter, Loader2, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChannelListItem, ChannelItemSkeleton } from './ChannelListItem';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface Channel {
  id: string;
  name: string;
  stream_url: string;
  tvg_logo: string | null;
  tvg_id: string | null;
  category_id: string;
  category_name?: string;
  group_title?: string;
  order_position: number;
}

export interface InfiniteChannelListProps {
  channels: Channel[];
  totalCount: number;
  isLoading?: boolean;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  selectedChannelId?: string;
  favoriteIds?: Set<string>;
  recentIds?: Set<string>;
  onChannelSelect: (channel: Channel) => void;
  onFavoriteToggle?: (channel: Channel) => void;
  onLoadMore: () => void;
  onRefresh?: () => void;
  className?: string;
  height?: number | string;
  itemHeight?: number;
  overscan?: number;
  showSearch?: boolean;
  showGroupFilter?: boolean;
  showRefresh?: boolean;
}

export interface InfiniteChannelListRef {
  scrollToChannel: (channelId: string) => void;
  scrollToIndex: (index: number) => void;
  scrollToTop: () => void;
}

// Debounce hook for search
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

export const InfiniteChannelList = forwardRef<InfiniteChannelListRef, InfiniteChannelListProps>(({
  channels,
  totalCount,
  isLoading = false,
  isLoadingMore = false,
  hasMore = false,
  selectedChannelId,
  favoriteIds = new Set(),
  recentIds = new Set(),
  onChannelSelect,
  onFavoriteToggle,
  onLoadMore,
  onRefresh,
  className,
  height = '100%',
  itemHeight = 60,
  overscan = 10,
  showSearch = true,
  showGroupFilter = true,
  showRefresh = true,
}, ref) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const debouncedSearch = useDebounce(searchQuery, 150);

  // Extract unique groups
  const groups = useMemo(() => {
    const groupSet = new Set<string>();
    channels.forEach(c => {
      const group = c.category_name || c.group_title || 'Sem categoria';
      groupSet.add(group);
    });
    return Array.from(groupSet).sort();
  }, [channels]);

  // Filter channels
  const filteredChannels = useMemo(() => {
    let result = channels;

    // Filter by group
    if (selectedGroup) {
      result = result.filter(c => 
        (c.category_name || c.group_title || 'Sem categoria') === selectedGroup
      );
    }

    // Filter by search
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      result = result.filter(c => 
        c.name.toLowerCase().includes(searchLower) ||
        (c.category_name?.toLowerCase().includes(searchLower)) ||
        (c.group_title?.toLowerCase().includes(searchLower))
      );
    }

    return result;
  }, [channels, selectedGroup, debouncedSearch]);

  // Virtualizer
  const virtualizer = useVirtualizer({
    count: filteredChannels.length + (hasMore ? 1 : 0), // +1 for loading indicator
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight,
    overscan,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Infinite scroll detection
  useEffect(() => {
    const lastItem = virtualItems[virtualItems.length - 1];
    
    if (
      lastItem &&
      lastItem.index >= filteredChannels.length - 1 &&
      hasMore &&
      !isLoadingMore &&
      !debouncedSearch // Don't load more when searching
    ) {
      onLoadMore();
    }
  }, [virtualItems, filteredChannels.length, hasMore, isLoadingMore, onLoadMore, debouncedSearch]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    scrollToChannel: (channelId: string) => {
      const index = filteredChannels.findIndex(c => c.id === channelId);
      if (index >= 0) {
        virtualizer.scrollToIndex(index, { align: 'center' });
        setFocusedIndex(index);
      }
    },
    scrollToIndex: (index: number) => {
      virtualizer.scrollToIndex(index, { align: 'center' });
      setFocusedIndex(index);
    },
    scrollToTop: () => {
      virtualizer.scrollToIndex(0);
    },
  }), [filteredChannels, virtualizer]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!filteredChannels.length) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = Math.min(prev + 1, filteredChannels.length - 1);
          virtualizer.scrollToIndex(next, { align: 'auto' });
          return next;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = Math.max(prev - 1, 0);
          virtualizer.scrollToIndex(next, { align: 'auto' });
          return next;
        });
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < filteredChannels.length) {
          onChannelSelect(filteredChannels[focusedIndex]);
        }
        break;
      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        virtualizer.scrollToIndex(0);
        break;
      case 'End':
        e.preventDefault();
        const lastIndex = filteredChannels.length - 1;
        setFocusedIndex(lastIndex);
        virtualizer.scrollToIndex(lastIndex);
        break;
    }
  }, [filteredChannels, focusedIndex, onChannelSelect, virtualizer]);

  // Render header with search and filters
  const renderHeader = () => (
    <div className="flex items-center gap-2 p-2 border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-10">
      {showSearch && (
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar canal..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
      )}

      {showGroupFilter && groups.length > 1 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1.5">
              <Filter className="h-3.5 w-3.5" />
              <span className="hidden sm:inline truncate max-w-[100px]">
                {selectedGroup || 'Todos'}
              </span>
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-[300px] overflow-auto">
            <DropdownMenuItem onClick={() => setSelectedGroup(null)}>
              Todos os grupos
            </DropdownMenuItem>
            {groups.map(group => (
              <DropdownMenuItem key={group} onClick={() => setSelectedGroup(group)}>
                {group}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {showRefresh && onRefresh && (
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-9 w-9" 
          onClick={onRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
        </Button>
      )}
    </div>
  );

  // Render stats
  const renderStats = () => (
    <div className="flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground border-b border-border">
      <span>
        {filteredChannels.length.toLocaleString()} de {totalCount.toLocaleString()} canais
      </span>
      {debouncedSearch && (
        <span className="text-primary">
          Filtrado: "{debouncedSearch}"
        </span>
      )}
    </div>
  );

  // Loading state
  if (isLoading && channels.length === 0) {
    return (
      <div className={cn("flex flex-col", className)} style={{ height }}>
        {renderHeader()}
        <div className="flex-1 overflow-hidden">
          {Array.from({ length: 10 }).map((_, i) => (
            <ChannelItemSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (!isLoading && filteredChannels.length === 0) {
    return (
      <div className={cn("flex flex-col", className)} style={{ height }}>
        {renderHeader()}
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-4">
          {debouncedSearch || selectedGroup ? (
            <>
              <Search className="h-10 w-10 mb-2 opacity-50" />
              <p className="text-center">Nenhum canal encontrado</p>
              <Button 
                variant="link" 
                onClick={() => {
                  setSearchQuery('');
                  setSelectedGroup(null);
                }}
                className="mt-2"
              >
                Limpar filtros
              </Button>
            </>
          ) : (
            <>
              <Loader2 className="h-10 w-10 mb-2 animate-spin" />
              <p>Carregando canais...</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div 
      className={cn("flex flex-col", className)} 
      style={{ height }}
      onKeyDown={handleKeyDown}
    >
      {renderHeader()}
      {renderStats()}
      
      <div
        ref={parentRef}
        className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualItems.map((virtualRow) => {
            const isLoaderRow = virtualRow.index >= filteredChannels.length;
            
            if (isLoaderRow) {
              return (
                <div
                  key="loader"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Carregando mais canais...</span>
                  </div>
                </div>
              );
            }

            const channel = filteredChannels[virtualRow.index];
            const isSelected = channel.id === selectedChannelId;
            const isFocused = virtualRow.index === focusedIndex;

            return (
              <div
                key={channel.id}
                data-index={virtualRow.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className={cn(isFocused && "ring-2 ring-primary ring-inset")}
              >
                <ChannelListItem
                  channel={channel}
                  index={virtualRow.index}
                  isSelected={isSelected}
                  isFavorite={favoriteIds.has(channel.id)}
                  isRecentlyWatched={recentIds.has(channel.id)}
                  onSelect={onChannelSelect}
                  onFavoriteToggle={onFavoriteToggle}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer with load status */}
      {!hasMore && filteredChannels.length > 0 && (
        <div className="text-center py-2 text-xs text-muted-foreground border-t border-border">
          Todos os {filteredChannels.length.toLocaleString()} canais carregados
        </div>
      )}
    </div>
  );
});

InfiniteChannelList.displayName = 'InfiniteChannelList';

export default InfiniteChannelList;
