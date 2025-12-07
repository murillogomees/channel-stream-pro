/**
 * TVLiveCategoryList - Live TV content grouped by categories with collapsible dropdowns
 * 
 * Shows all categories upfront with channel counts.
 * User can expand/collapse each category to see its channels.
 */

import { useState, useMemo, useCallback, memo, useRef } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, Tv, Star, Radio, Folder } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useVirtualizer } from '@tanstack/react-virtual';

interface Channel {
  id: string;
  name: string;
  stream_url?: string;
  tvg_logo?: string;
  category_name?: string;
  category_id?: string;
}

interface Category {
  id: string;
  name: string;
  display_name?: string;
  channels: Channel[];
}

interface TVLiveCategoryListProps {
  categories: Category[];
  currentChannelId?: string;
  onChannelSelect: (channel: Channel) => void;
  onFavoriteToggle?: (channelId: string) => void;
  isFavorite?: (channelId: string) => boolean;
  className?: string;
  searchQuery?: string;
}

// Memoized channel item
const ChannelItem = memo(function ChannelItem({
  channel,
  isActive,
  isFav,
  onSelect,
  onFavoriteToggle,
}: {
  channel: Channel;
  isActive: boolean;
  isFav: boolean;
  onSelect: () => void;
  onFavoriteToggle?: () => void;
}) {
  const handleFavoriteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onFavoriteToggle?.();
  }, [onFavoriteToggle]);

  return (
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
  );
});

// Category section with collapsible content
const CategorySection = memo(function CategorySection({
  category,
  isExpanded,
  onToggle,
  currentChannelId,
  onChannelSelect,
  onFavoriteToggle,
  isFavorite,
  filteredChannels,
}: {
  category: Category;
  isExpanded: boolean;
  onToggle: () => void;
  currentChannelId?: string;
  onChannelSelect: (channel: Channel) => void;
  onFavoriteToggle?: (channelId: string) => void;
  isFavorite?: (channelId: string) => boolean;
  filteredChannels: Channel[];
}) {
  const displayName = category.display_name || category.name;
  const channelCount = filteredChannels.length;

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card/50">
      {/* Category header - clickable to expand/collapse */}
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center justify-between p-3 sm:p-4",
          "hover:bg-muted/50 transition-colors",
          isExpanded && "bg-muted/30 border-b border-border"
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0">
            {isExpanded ? (
              <ChevronDown className="w-5 h-5 text-primary" />
            ) : (
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          <Folder className="w-5 h-5 text-primary flex-shrink-0" />
          <span className="font-medium text-sm sm:text-base truncate">
            {displayName}
          </span>
        </div>
        <Badge variant="secondary" className="ml-2 flex-shrink-0">
          {channelCount.toLocaleString()}
        </Badge>
      </button>

      {/* Expanded channel list */}
      {isExpanded && channelCount > 0 && (
        <div className="max-h-[50vh] overflow-y-auto">
          <div className="p-2 space-y-1">
            {filteredChannels.map((channel) => (
              <ChannelItem
                key={channel.id}
                channel={channel}
                isActive={channel.id === currentChannelId}
                isFav={isFavorite?.(channel.id) ?? false}
                onSelect={() => onChannelSelect(channel)}
                onFavoriteToggle={
                  onFavoriteToggle ? () => onFavoriteToggle(channel.id) : undefined
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state for filtered category */}
      {isExpanded && channelCount === 0 && (
        <div className="p-4 text-center text-muted-foreground text-sm">
          Nenhum canal encontrado nesta categoria
        </div>
      )}
    </div>
  );
});

export const TVLiveCategoryList = memo(function TVLiveCategoryList({
  categories,
  currentChannelId,
  onChannelSelect,
  onFavoriteToggle,
  isFavorite,
  className,
  searchQuery = '',
}: TVLiveCategoryListProps) {
  // Track which categories are expanded
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Toggle category expansion
  const toggleCategory = useCallback((categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  // Filter channels based on search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery) return categories;
    
    const query = searchQuery.toLowerCase();
    return categories
      .map(cat => ({
        ...cat,
        channels: cat.channels.filter(ch => 
          ch.name.toLowerCase().includes(query)
        )
      }))
      .filter(cat => cat.channels.length > 0);
  }, [categories, searchQuery]);

  // Total channel count
  const totalChannels = useMemo(() => {
    return filteredCategories.reduce((acc, cat) => acc + cat.channels.length, 0);
  }, [filteredCategories]);

  // Expand all/collapse all
  const expandAll = useCallback(() => {
    setExpandedCategories(new Set(filteredCategories.map(cat => cat.id)));
  }, [filteredCategories]);

  const collapseAll = useCallback(() => {
    setExpandedCategories(new Set());
  }, []);

  if (filteredCategories.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-full text-muted-foreground", className)}>
        <p>Nenhum canal encontrado</p>
      </div>
    );
  }

  return (
    <div className={cn("h-full flex flex-col", className)}>
      {/* Header with stats and controls */}
      <div className="flex items-center justify-between px-2 py-3 border-b border-border">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{filteredCategories.length}</span> categorias · {' '}
          <span className="font-medium text-foreground">{totalChannels.toLocaleString()}</span> canais
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="text-xs text-primary hover:underline"
          >
            Expandir tudo
          </button>
          <span className="text-muted-foreground">|</span>
          <button
            onClick={collapseAll}
            className="text-xs text-primary hover:underline"
          >
            Recolher tudo
          </button>
        </div>
      </div>

      {/* Category list with scroll */}
      <ScrollArea className="flex-1">
        <div className="p-2 sm:p-4 space-y-2">
          {filteredCategories.map((category) => (
            <CategorySection
              key={category.id}
              category={category}
              isExpanded={expandedCategories.has(category.id)}
              onToggle={() => toggleCategory(category.id)}
              currentChannelId={currentChannelId}
              onChannelSelect={onChannelSelect}
              onFavoriteToggle={onFavoriteToggle}
              isFavorite={isFavorite}
              filteredChannels={category.channels}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
});

export default TVLiveCategoryList;
