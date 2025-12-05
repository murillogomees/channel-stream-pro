/**
 * Channel List Item Component
 * 
 * Individual channel item with lazy loading for logos
 * Optimized for virtualized lists
 */

import React, { useState, useCallback, memo } from 'react';
import { cn } from '@/lib/utils';
import { Tv, Radio, Film, Play, Heart, Loader2 } from 'lucide-react';

interface Channel {
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

interface ChannelListItemProps {
  channel: Channel;
  index: number;
  isSelected?: boolean;
  isFavorite?: boolean;
  isRecentlyWatched?: boolean;
  onSelect: (channel: Channel) => void;
  onFavoriteToggle?: (channel: Channel) => void;
  style?: React.CSSProperties;
}

// Lazy loaded image with placeholder
const LazyLogo: React.FC<{ src: string | null; alt: string; fallbackIcon: React.ReactNode }> = memo(({ 
  src, 
  alt, 
  fallbackIcon 
}) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (!src || error) {
    return <>{fallbackIcon}</>;
  }

  return (
    <>
      {!loaded && (
        <div className="absolute inset-0 bg-muted animate-pulse rounded" />
      )}
      <img
        src={src}
        alt={alt}
        className={cn(
          "w-full h-full object-contain transition-opacity duration-200",
          loaded ? "opacity-100" : "opacity-0"
        )}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </>
  );
});

LazyLogo.displayName = 'LazyLogo';

// Get icon based on channel type
const getChannelIcon = (channel: Channel) => {
  const name = channel.name.toLowerCase();
  if (name.includes('radio') || name.includes('fm ') || name.includes('am ')) {
    return <Radio className="h-5 w-5 text-muted-foreground" />;
  }
  if (name.includes('filme') || name.includes('movie') || name.includes('cinema') || name.includes('vod')) {
    return <Film className="h-5 w-5 text-muted-foreground" />;
  }
  return <Tv className="h-5 w-5 text-muted-foreground" />;
};

export const ChannelListItem: React.FC<ChannelListItemProps> = memo(({
  channel,
  index,
  isSelected = false,
  isFavorite = false,
  isRecentlyWatched = false,
  onSelect,
  onFavoriteToggle,
  style,
}) => {
  const handleClick = useCallback(() => {
    onSelect(channel);
  }, [channel, onSelect]);

  const handleFavoriteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onFavoriteToggle?.(channel);
  }, [channel, onFavoriteToggle]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(channel);
    }
  }, [channel, onSelect]);

  return (
    <div
      style={style}
      className={cn(
        "flex items-center gap-3 px-3 py-2 cursor-pointer transition-all duration-150",
        "hover:bg-accent/60 focus-within:bg-accent/60",
        "border-l-2 border-transparent",
        isSelected && "bg-primary/15 border-l-primary",
        isRecentlyWatched && !isSelected && "bg-accent/30"
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-selected={isSelected}
      data-channel-id={channel.id}
    >
      {/* Channel Number */}
      <div className="flex-shrink-0 w-8 text-xs text-muted-foreground tabular-nums text-right">
        {index + 1}
      </div>

      {/* Channel Logo */}
      <div className="relative flex-shrink-0 w-10 h-10 rounded-md bg-muted/50 flex items-center justify-center overflow-hidden">
        <LazyLogo
          src={channel.tvg_logo}
          alt={channel.name}
          fallbackIcon={getChannelIcon(channel)}
        />
      </div>

      {/* Channel Info */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm font-medium truncate",
          isSelected ? "text-primary" : "text-foreground"
        )}>
          {channel.name}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {channel.category_name || channel.group_title || 'Sem categoria'}
        </p>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-1.5">
        {isRecentlyWatched && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-accent text-[10px] text-muted-foreground">
            <Play className="h-2.5 w-2.5" />
            Recente
          </div>
        )}

        {onFavoriteToggle && (
          <button
            onClick={handleFavoriteClick}
            className={cn(
              "p-1 rounded-full transition-colors",
              isFavorite 
                ? "text-red-500 hover:text-red-600" 
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-label={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          >
            <Heart className={cn("h-4 w-4", isFavorite && "fill-current")} />
          </button>
        )}
      </div>
    </div>
  );
});

ChannelListItem.displayName = 'ChannelListItem';

// Skeleton loader for channel item
export const ChannelItemSkeleton: React.FC<{ style?: React.CSSProperties }> = memo(({ style }) => (
  <div style={style} className="flex items-center gap-3 px-3 py-2 animate-pulse">
    <div className="flex-shrink-0 w-8 h-4 bg-muted rounded" />
    <div className="flex-shrink-0 w-10 h-10 bg-muted rounded-md" />
    <div className="flex-1 space-y-2">
      <div className="h-4 bg-muted rounded w-3/4" />
      <div className="h-3 bg-muted rounded w-1/2" />
    </div>
  </div>
));

ChannelItemSkeleton.displayName = 'ChannelItemSkeleton';
