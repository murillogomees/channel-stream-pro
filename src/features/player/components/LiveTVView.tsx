/**
 * LiveTVView - Complete Live TV interface with EPG, zapping, PIP
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Tv, List, PictureInPicture2, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useChannelEPG } from '../hooks/useEPG';
import { useChannelZapping } from '../hooks/useChannelZapping';
import { usePictureInPicture } from '../hooks/usePictureInPicture';
import { ChannelOSD } from './ChannelOSD';
import { MiniChannelList } from './MiniChannelList';
import { EPGStrip } from './EPGStrip';

interface Channel {
  id: string;
  name: string;
  stream_url: string;
  tvg_logo?: string;
  tvg_id?: string;
  category_name?: string;
}

interface LiveTVViewProps {
  channels: Channel[];
  currentChannel: Channel | null;
  onChannelChange: (channel: Channel) => void;
  onPlay: (channel: Channel) => void;
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (id: string) => void;
  className?: string;
}

export function LiveTVView({
  channels,
  currentChannel,
  onChannelChange,
  onPlay,
  isFavorite,
  onToggleFavorite,
  className,
}: LiveTVViewProps) {
  const [showChannelList, setShowChannelList] = useState(false);
  const [previewChannel, setPreviewChannel] = useState<Channel | null>(null);
  
  // EPG for current channel
  const {
    current: currentProgram,
    next: nextProgram,
    progress: epgProgress,
    timeRemaining,
  } = useChannelEPG(currentChannel?.tvg_id || currentChannel?.id || null);

  // Channel zapping
  const {
    currentIndex,
    totalChannels,
    recentChannels,
    numberInput,
    isShowingOSD,
    nextChannel,
    previousChannel,
    goToChannelNumber,
    zapBack,
    showOSD,
    hideOSD,
    getChannelNumber,
  } = useChannelZapping({
    channels,
    currentChannel,
    onChannelChange: (channel) => {
      onChannelChange(channel);
      setPreviewChannel(channel);
    },
  });

  // Handle channel selection from list
  const handleSelectChannel = useCallback((channel: Channel) => {
    onChannelChange(channel);
    setShowChannelList(false);
    showOSD();
  }, [onChannelChange, showOSD]);

  // Handle play button
  const handlePlayChannel = useCallback((channel: Channel) => {
    onPlay(channel);
    setShowChannelList(false);
  }, [onPlay]);

  // Preview timeout for hover effect
  useEffect(() => {
    if (previewChannel) {
      const timeout = setTimeout(() => {
        setPreviewChannel(null);
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [previewChannel]);

  return (
    <div className={cn('relative', className)}>
      {/* Main Content Area */}
      <div className="space-y-3 sm:space-y-4">
        {/* Featured Channel / Current Preview */}
        {currentChannel && (
          <div className="relative rounded-xl overflow-hidden bg-gradient-to-br from-muted to-background border border-border">
            {/* Preview Area */}
            <div className="aspect-video relative">
              {/* Channel Logo/Preview */}
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-background via-transparent to-transparent">
                {currentChannel.tvg_logo ? (
                  <img
                    src={currentChannel.tvg_logo}
                    alt={currentChannel.name}
                    className="max-w-[120px] sm:max-w-[200px] max-h-[60px] sm:max-h-[100px] object-contain drop-shadow-lg"
                  />
                ) : (
                  <Tv className="w-16 h-16 sm:w-24 sm:h-24 text-muted-foreground/30" />
                )}
              </div>

              {/* Channel Info Overlay */}
              <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4 bg-gradient-to-t from-background to-transparent">
                {/* Mobile Layout */}
                <div className="flex flex-col gap-3 sm:hidden">
                  <div className="flex items-center gap-3">
                    {/* Channel Number */}
                    <div className="w-10 h-10 flex items-center justify-center bg-primary/20 rounded-lg flex-shrink-0">
                      <span className="text-lg font-bold text-primary">
                        {getChannelNumber(currentChannel) || '?'}
                      </span>
                    </div>

                    {/* Channel Details */}
                    <div className="flex-1 min-w-0">
                      <h2 className="text-base font-bold text-foreground truncate">
                        {currentChannel.name}
                      </h2>
                      {currentChannel.category_name && (
                        <span className="text-xs text-muted-foreground line-clamp-1">
                          {currentChannel.category_name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Mobile Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="default"
                      onClick={() => handlePlayChannel(currentChannel)}
                      className="flex-1 h-10 text-sm"
                    >
                      Assistir
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10"
                      onClick={() => onToggleFavorite(currentChannel.id)}
                    >
                      <svg
                        className="w-4 h-4"
                        fill={isFavorite(currentChannel.id) ? 'currentColor' : 'none'}
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10"
                      onClick={() => setShowChannelList(true)}
                    >
                      <List className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Desktop Layout */}
                <div className="hidden sm:flex items-center gap-4">
                  {/* Channel Number */}
                  <div className="w-14 h-14 flex items-center justify-center bg-primary/20 rounded-lg">
                    <span className="text-2xl font-bold text-primary">
                      {getChannelNumber(currentChannel) || '?'}
                    </span>
                  </div>

                  {/* Channel Details */}
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-foreground mb-1">
                      {currentChannel.name}
                    </h2>
                    {currentChannel.category_name && (
                      <span className="text-sm text-muted-foreground">
                        {currentChannel.category_name}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => onToggleFavorite(currentChannel.id)}
                      className={cn(
                        isFavorite(currentChannel.id) && 'text-yellow-500 border-yellow-500/50'
                      )}
                    >
                      <svg
                        className="w-5 h-5"
                        fill={isFavorite(currentChannel.id) ? 'currentColor' : 'none'}
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowChannelList(true)}
                    >
                      <List className="w-5 h-5" />
                    </Button>

                    <Button
                      variant="default"
                      onClick={() => handlePlayChannel(currentChannel)}
                      className="px-6"
                    >
                      Assistir Ao Vivo
                    </Button>
                  </div>
                </div>

                {/* EPG Strip */}
                {(currentProgram || nextProgram) && (
                  <div className="mt-3 sm:mt-4">
                    <EPGStrip
                      currentProgram={currentProgram}
                      nextProgram={nextProgram}
                      progress={epgProgress}
                      timeRemaining={timeRemaining}
                    />
                  </div>
                )}
              </div>

              {/* Live Badge */}
              <div className="absolute top-2 left-2 sm:top-4 sm:left-4">
                <span className="px-2 py-0.5 sm:px-3 sm:py-1 bg-red-600 text-white text-[10px] sm:text-xs font-bold rounded-full animate-pulse">
                  AO VIVO
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Quick Access Channels */}
        <div className="space-y-3 sm:space-y-4">
          {/* Recent Channels */}
          {recentChannels.length > 0 && (
            <div>
              <h3 className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 sm:mb-3">
                Canais Recentes
              </h3>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
                {recentChannels.map((channel) => (
                  <ChannelChip
                    key={channel.id}
                    channel={channel}
                    channelNumber={getChannelNumber(channel)}
                    isCurrent={channel.id === currentChannel?.id}
                    onClick={() => handleSelectChannel(channel)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Zapping Controls - Mobile */}
          <div className="flex sm:hidden items-center justify-between gap-2 py-2">
            <Button
              variant="outline"
              size="sm"
              onClick={previousChannel}
              className="flex-1 h-9 text-xs"
            >
              ◀ Anterior
            </Button>
            
            <Button
              variant="secondary"
              size="sm"
              onClick={zapBack}
              disabled={recentChannels.length === 0}
              className="h-9 px-4 text-xs"
            >
              ⌫
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={nextChannel}
              className="flex-1 h-9 text-xs"
            >
              Próximo ▶
            </Button>
          </div>

          {/* Zapping Controls - Desktop */}
          <div className="hidden sm:flex items-center justify-center gap-4 py-4">
            <Button
              variant="outline"
              size="lg"
              onClick={previousChannel}
              className="flex-1 max-w-[150px]"
            >
              ◀ Canal Anterior
            </Button>
            
            <Button
              variant="secondary"
              size="lg"
              onClick={zapBack}
              disabled={recentChannels.length === 0}
              className="px-8"
            >
              ⌫ Voltar
            </Button>
            
            <Button
              variant="outline"
              size="lg"
              onClick={nextChannel}
              className="flex-1 max-w-[150px]"
            >
              Próximo Canal ▶
            </Button>
          </div>

          {/* Channel Count */}
          <div className="text-center text-xs sm:text-sm text-muted-foreground">
            Canal {currentIndex + 1} de {totalChannels}
          </div>
        </div>
      </div>

      {/* Channel OSD */}
      {currentChannel && (
        <ChannelOSD
          channel={currentChannel}
          channelNumber={getChannelNumber(currentChannel)}
          totalChannels={totalChannels}
          numberInput={numberInput}
          currentProgram={currentProgram}
          nextProgram={nextProgram}
          progress={epgProgress}
          timeRemaining={timeRemaining}
          isVisible={isShowingOSD}
        />
      )}

      {/* Channel List Sidebar */}
      <MiniChannelList
        channels={channels}
        currentChannelId={currentChannel?.id}
        recentChannels={recentChannels}
        onSelectChannel={handleSelectChannel}
        onClose={() => setShowChannelList(false)}
        isVisible={showChannelList}
        getChannelNumber={getChannelNumber}
      />
    </div>
  );
}

// Small channel chip component
function ChannelChip({
  channel,
  channelNumber,
  isCurrent,
  onClick,
}: {
  channel: Channel;
  channelNumber: number | null;
  isCurrent: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border transition-colors',
        'hover:bg-muted whitespace-nowrap flex-shrink-0 active:scale-95',
        isCurrent 
          ? 'border-primary bg-primary/10 text-primary' 
          : 'border-border bg-background'
      )}
    >
      {channel.tvg_logo && (
        <img
          src={channel.tvg_logo}
          alt=""
          className="w-5 h-5 sm:w-6 sm:h-6 rounded object-contain"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      )}
      <span className="text-xs sm:text-sm font-medium max-w-[100px] sm:max-w-none truncate">
        {channelNumber && <span className="text-muted-foreground mr-0.5 sm:mr-1">{channelNumber}.</span>}
        {channel.name}
      </span>
    </button>
  );
}
