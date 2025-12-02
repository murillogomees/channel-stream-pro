/**
 * ============================================================================
 * TVPlayer - Página de Player Otimizada para TVs
 * ============================================================================
 * 
 * Página fullscreen para reprodução em Smart TVs:
 * - Samsung Tizen
 * - LG webOS
 * - Android TV / Fire Stick
 * - WebView
 * 
 * @version 1.0.0
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { VideoPlayer } from '@/components/player/VideoPlayer';
import { 
  useFocusManagerInit, 
  useBackHandler,
  useIPTVPlaylist,
  streamService,
} from '@/modules/player';
import { telemetryService } from '@/modules/player/core';
import { cn } from '@/lib/utils';

export default function TVPlayer() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const channelUrl = searchParams.get('url');
  const channelName = searchParams.get('name') || 'Canal';
  const channelLogo = searchParams.get('logo') || undefined;
  const channelId = searchParams.get('id') || 'unknown';
  const m3uUrl = searchParams.get('m3u') || null;

  const [showChannelList, setShowChannelList] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize focus manager for TV navigation
  useFocusManagerInit();

  // Handle back button
  useBackHandler(() => {
    if (showChannelList) {
      setShowChannelList(false);
    } else {
      navigate(-1);
    }
  });

  // Playlist management (if M3U URL provided)
  const {
    channels,
    categories,
    currentChannel,
    selectChannel,
    nextChannel,
    previousChannel,
    getPlayableUrl,
    isLoading: isPlaylistLoading,
  } = useIPTVPlaylist({
    m3uUrl,
    autoLoad: !!m3uUrl,
    onChannelSelect: (channel) => {
      // Update URL with new channel
      const url = getPlayableUrl(channel);
      const params = new URLSearchParams({
        url,
        name: channel.name,
        logo: channel.tvg_logo || '',
        id: channel.id,
        ...(m3uUrl && { m3u: m3uUrl }),
      });
      navigate(`/tv-player?${params.toString()}`, { replace: true });
    },
  });

  // Start telemetry session
  useEffect(() => {
    if (channelUrl) {
      telemetryService.startSession(channelId, channelName);
    }

    return () => {
      const metrics = telemetryService.endSession();
      if (metrics) {
        console.log('[TVPlayer] Session metrics:', metrics);
      }
    };
  }, [channelId, channelName, channelUrl]);

  // Get playable URL with CDN optimization
  const playableUrl = channelUrl 
    ? streamService.getPlayableUrl(channelUrl)
    : null;

  // For future: async CDN optimization
  // const [optimizedUrl, setOptimizedUrl] = useState<string | null>(null);
  // useEffect(() => {
  //   if (currentChannel) {
  //     streamService.getOptimizedUrl(currentChannel).then(result => {
  //       setOptimizedUrl(result.url);
  //     });
  //   }
  // }, [currentChannel]);

  const handleError = useCallback((msg: string) => {
    setError(msg);
    telemetryService.recordError({
      type: 'media',
      code: 'PLAYBACK_ERROR',
      message: msg,
      fatal: true,
      recovered: false,
      context: { channelId, channelName },
    });
  }, [channelId, channelName]);

  const handleReady = useCallback(() => {
    telemetryService.recordPlaybackStart();
    setError(null);
  }, []);

  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  // No URL provided
  if (!playableUrl) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-foreground mb-4">
            Nenhum canal selecionado
          </h1>
          <p className="text-muted-foreground mb-6">
            Selecione um canal para começar a assistir
          </p>
          <button
            onClick={handleBack}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg tv-button"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black">
      {/* Player */}
      <VideoPlayer
        url={playableUrl}
        title={channelName}
        logo={channelLogo}
        autoPlay
        onError={handleError}
        onReady={handleReady}
        onBack={handleBack}
        className="w-full h-full"
      />

      {/* Channel List Overlay (optional) */}
      {showChannelList && channels.length > 0 && (
        <div
          className={cn(
            'absolute inset-y-0 right-0 w-80 bg-background/95 backdrop-blur',
            'transform transition-transform duration-300',
            'flex flex-col'
          )}
        >
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold">Canais</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {categories.map((category) => (
              <div key={category.id} className="border-b border-border">
                <div className="px-4 py-2 bg-muted/50 text-sm font-medium text-muted-foreground">
                  {category.display_name}
                </div>
                {category.channels.slice(0, 10).map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => selectChannel(channel)}
                    className={cn(
                      'w-full px-4 py-3 flex items-center gap-3 text-left',
                      'hover:bg-muted/50 transition-colors tv-button',
                      currentChannel?.id === channel.id && 'bg-primary/20'
                    )}
                  >
                    {channel.tvg_logo && (
                      <img
                        src={channel.tvg_logo}
                        alt=""
                        className="w-8 h-8 rounded object-contain bg-muted"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    )}
                    <span className="text-sm truncate">{channel.name}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Navigation Hints */}
      <div className="absolute bottom-4 left-4 text-xs text-muted-foreground/50 pointer-events-none">
        <p>CH+ / CH- = Trocar canal</p>
        <p>INFO = Lista de canais</p>
        <p>BACK = Voltar</p>
      </div>
    </div>
  );
}
