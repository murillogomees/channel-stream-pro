/**
 * MiniChannelList - Quick channel switcher overlay
 * With intelligent preloading support
 */

import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { Search, Tv, Star, Clock, X, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChannelPreloader } from '@/hooks/useChannelPreloader';
import { PreloadIndicator } from '@/components/player/PreloadIndicator';

interface Channel {
  id: string;
  name: string;
  stream_url?: string;
  tvg_logo?: string;
  category_name?: string;
}

interface MiniChannelListProps {
  channels: Channel[];
  currentChannelId?: string;
  currentCategoryId?: string;
  profileId?: string;
  recentChannels?: Channel[];
  onSelectChannel: (channel: Channel) => void;
  onClose: () => void;
  isVisible: boolean;
  className?: string;
  getChannelNumber?: (channel: Channel) => number | null;
  enablePreload?: boolean;
}

export const MiniChannelList = memo(function MiniChannelList({
  channels,
  currentChannelId,
  currentCategoryId,
  profileId,
  recentChannels = [],
  onSelectChannel,
  onClose,
  isVisible,
  className,
  getChannelNumber,
  enablePreload = true,
}: MiniChannelListProps) {
  const [search, setSearch] = useState('');
  const [show, setShow] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Intelligent preloading
  const {
    preloadOnHover,
    getChannelPreloadStatus,
    stats,
    isPreloading,
  } = useChannelPreloader({
    channels: channels.filter(c => c.stream_url) as Array<{ id: string; name: string; stream_url: string }>,
    currentChannelId,
    currentCategoryId,
    profileId,
    enabled: enablePreload && isVisible,
  });

  // Handle hover for preloading
  const handleChannelHover = useCallback((channelId: string) => {
    if (enablePreload) {
      preloadOnHover(channelId);
    }
  }, [enablePreload, preloadOnHover]);

  // Animate entrance
  useEffect(() => {
    if (isVisible) {
      setShow(true);
      setTimeout(() => searchRef.current?.focus(), 100);
    } else {
      const timeout = setTimeout(() => {
        setShow(false);
        setSearch('');
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [isVisible]);

  // Filter channels
  const filteredChannels = channels.filter(ch =>
    ch.name.toLowerCase().includes(search.toLowerCase()) ||
    ch.category_name?.toLowerCase().includes(search.toLowerCase())
  );

  // Keyboard navigation
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, onClose]);

  if (!show) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-black/60 z-40 transition-opacity duration-300',
          isVisible ? 'opacity-100' : 'opacity-0'
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          'fixed right-0 top-0 bottom-0 w-full max-w-sm bg-background border-l border-border z-50',
          'transform transition-transform duration-300 ease-out',
          isVisible ? 'translate-x-0' : 'translate-x-full',
          className
        )}
      >
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold">Canais</h2>
              {enablePreload && isPreloading && (
                <span className="flex items-center gap-1 text-xs text-yellow-500">
                  <Zap className="w-3 h-3 animate-pulse" />
                </span>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              ref={searchRef}
              placeholder="Buscar canal..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          
          {/* Preload stats (debug) */}
          {enablePreload && stats.preloaded > 0 && (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Zap className="w-3 h-3 text-green-500" />
              <span>{stats.preloaded} pré-carregados</span>
              {stats.cacheHits > 0 && (
                <span className="text-green-500">• {stats.cacheHits} hits</span>
              )}
            </div>
          )}
        </div>

        <ScrollArea className="h-[calc(100vh-120px)]">
          {/* Recent Channels */}
          {!search && recentChannels.length > 0 && (
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Recentes</span>
              </div>
              <div className="space-y-1">
                {recentChannels.map((channel) => {
                  const preloadStatus = enablePreload ? getChannelPreloadStatus(channel.id) : null;
                  return (
                    <ChannelItem
                      key={`recent-${channel.id}`}
                      channel={channel}
                      isCurrent={channel.id === currentChannelId}
                      channelNumber={getChannelNumber?.(channel)}
                      onClick={() => onSelectChannel(channel)}
                      onHover={() => handleChannelHover(channel.id)}
                      preloadStatus={preloadStatus}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* All Channels */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">
                {search ? `Resultados (${filteredChannels.length})` : 'Todos os canais'}
              </span>
            </div>
            
            <div className="space-y-1">
              {filteredChannels.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Tv className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>Nenhum canal encontrado</p>
                </div>
              ) : (
                filteredChannels.map((channel) => {
                  const preloadStatus = enablePreload ? getChannelPreloadStatus(channel.id) : null;
                  return (
                    <ChannelItem
                      key={channel.id}
                      channel={channel}
                      isCurrent={channel.id === currentChannelId}
                      channelNumber={getChannelNumber?.(channel)}
                      onClick={() => onSelectChannel(channel)}
                      onHover={() => handleChannelHover(channel.id)}
                      preloadStatus={preloadStatus}
                    />
                  );
                })
              )}
            </div>
          </div>
        </ScrollArea>
      </div>
    </>
  );
});

// Channel item component with preload indicator
interface ChannelItemProps {
  channel: Channel;
  isCurrent: boolean;
  channelNumber?: number | null;
  onClick: () => void;
  onHover?: () => void;
  preloadStatus?: {
    isPreloaded: boolean;
    isPending: boolean;
    priority?: 'high' | 'medium' | 'low';
    reason?: string;
  } | null;
}

const ChannelItem = memo(function ChannelItem({
  channel,
  isCurrent,
  channelNumber,
  onClick,
  onHover,
  preloadStatus,
}: ChannelItemProps) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onHover}
      onFocus={onHover}
      className={cn(
        'w-full flex items-center gap-3 p-2 rounded-lg transition-colors',
        'hover:bg-muted focus:bg-muted focus:outline-none',
        isCurrent && 'bg-primary/10 border border-primary/30'
      )}
    >
      {/* Logo */}
      <div className="w-10 h-10 flex-shrink-0 rounded bg-muted overflow-hidden relative">
        {channel.tvg_logo ? (
          <img
            src={channel.tvg_logo}
            alt=""
            className="w-full h-full object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Tv className="w-5 h-5 text-muted-foreground" />
          </div>
        )}
        
        {/* Preload indicator badge */}
        {preloadStatus?.isPreloaded && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full flex items-center justify-center">
            <Zap className="w-2 h-2 text-white" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-2">
          {channelNumber && (
            <span className="text-xs font-mono text-muted-foreground">
              {channelNumber}
            </span>
          )}
          <span className="text-sm font-medium truncate">{channel.name}</span>
          {/* Inline preload indicator */}
          {preloadStatus && (
            <PreloadIndicator
              isPreloaded={preloadStatus.isPreloaded}
              isPending={preloadStatus.isPending}
              priority={preloadStatus.priority}
              className="ml-auto"
            />
          )}
        </div>
        {channel.category_name && (
          <span className="text-xs text-muted-foreground truncate block">
            {channel.category_name}
          </span>
        )}
      </div>

      {/* Current indicator */}
      {isCurrent && (
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
      )}
    </button>
  );
});
