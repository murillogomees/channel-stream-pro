/**
 * MiniChannelList - Quick channel switcher overlay
 */

import { memo, useState, useEffect, useRef } from 'react';
import { Search, Tv, Star, Clock, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Channel {
  id: string;
  name: string;
  tvg_logo?: string;
  category_name?: string;
}

interface MiniChannelListProps {
  channels: Channel[];
  currentChannelId?: string;
  recentChannels?: Channel[];
  onSelectChannel: (channel: Channel) => void;
  onClose: () => void;
  isVisible: boolean;
  className?: string;
  getChannelNumber?: (channel: Channel) => number | null;
}

export const MiniChannelList = memo(function MiniChannelList({
  channels,
  currentChannelId,
  recentChannels = [],
  onSelectChannel,
  onClose,
  isVisible,
  className,
  getChannelNumber,
}: MiniChannelListProps) {
  const [search, setSearch] = useState('');
  const [show, setShow] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

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
            <h2 className="text-lg font-bold">Canais</h2>
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
                {recentChannels.map((channel) => (
                  <ChannelItem
                    key={`recent-${channel.id}`}
                    channel={channel}
                    isCurrent={channel.id === currentChannelId}
                    channelNumber={getChannelNumber?.(channel)}
                    onClick={() => onSelectChannel(channel)}
                  />
                ))}
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
                filteredChannels.map((channel) => (
                  <ChannelItem
                    key={channel.id}
                    channel={channel}
                    isCurrent={channel.id === currentChannelId}
                    channelNumber={getChannelNumber?.(channel)}
                    onClick={() => onSelectChannel(channel)}
                  />
                ))
              )}
            </div>
          </div>
        </ScrollArea>
      </div>
    </>
  );
});

// Channel item component
const ChannelItem = memo(function ChannelItem({
  channel,
  isCurrent,
  channelNumber,
  onClick,
}: {
  channel: Channel;
  isCurrent: boolean;
  channelNumber?: number | null;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 p-2 rounded-lg transition-colors',
        'hover:bg-muted focus:bg-muted focus:outline-none',
        isCurrent && 'bg-primary/10 border border-primary/30'
      )}
    >
      {/* Logo */}
      <div className="w-10 h-10 flex-shrink-0 rounded bg-muted overflow-hidden">
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
