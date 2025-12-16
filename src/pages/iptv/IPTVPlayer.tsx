/**
 * IPTV Player Page - Fully Responsive with Streaming Optimization
 * Adapts to mobile, tablet, desktop, and TV screens
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { iptvService } from '@/services/iptvService';
import { ShakaPlayerUI } from '@/components/player';
import { useStreamingOptimization } from '@/hooks/useStreamingOptimization';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function IPTVPlayer() {
  const { channelId } = useParams<{ channelId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: channel, isLoading } = useQuery({
    queryKey: ['iptv-channel', channelId],
    queryFn: () => iptvService.getChannel(Number(channelId)),
    enabled: !!channelId,
  });

  // Initialize streaming optimization
  const {
    bufferConfig,
    predictions,
    updateBufferLevel,
    recordViewing,
    getPlayerConfig,
    isChannelPreloaded,
    getPreloadedUrl
  } = useStreamingOptimization({
    channelId: channelId ? Number(channelId) : undefined,
    contentType: channel?.content_type === 'vod' ? 'vod' : 'live',
    enablePredictivePreload: true,
    enableSmartBuffer: true
  });

  const handleBack = () => {
    // Record viewing duration when leaving
    recordViewing();
    navigate('/app/home');
  };

  const handleError = (message: string) => {
    console.error('[IPTVPlayer] Error:', message);
  };

  // Get optimized stream URL (preloaded if available)
  const getOptimizedUrl = () => {
    if (!channel?.original_url) return null;
    
    const channelIdNum = Number(channelId);
    if (isChannelPreloaded(channelIdNum)) {
      const preloadedUrl = getPreloadedUrl(channelIdNum);
      if (preloadedUrl) {
        console.log('[IPTVPlayer] Using preloaded URL for channel:', channelIdNum);
        return preloadedUrl;
      }
    }
    return channel.original_url;
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 animate-spin text-primary mx-auto" />
          <p className="text-white text-sm sm:text-base">Conectando ao canal...</p>
        </div>
      </div>
    );
  }

  const streamUrl = getOptimizedUrl();

  if (!streamUrl) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <p className="text-white text-sm sm:text-base">Canal não disponível</p>
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm sm:text-base hover:bg-primary/90 transition-colors"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  // Get player config from smart buffer service
  const playerConfig = getPlayerConfig('shaka');

  return (
    <div className="fixed inset-0 bg-black">
      {/* Player container - responsive aspect ratio */}
      <div className="w-full h-full">
        <ShakaPlayerUI
          streamUrl={streamUrl}
          title={channel?.name || 'Canal'}
          subtitle={channel?.category || undefined}
          brand={{
            name: 'IPTV Link',
            logo: channel?.logo_url || undefined,
            primaryColor: 'hsl(var(--primary))'
          }}
          onBack={handleBack}
          onError={handleError}
        />
      </div>

      {/* Debug overlay (only in development) */}
      {import.meta.env.DEV && bufferConfig && (
        <div className="fixed bottom-4 left-4 bg-black/80 text-white text-xs p-2 rounded max-w-xs">
          <div>Buffer: {bufferConfig.minBuffer}s - {bufferConfig.maxBuffer}s</div>
          <div>Predictions: {predictions.length}</div>
        </div>
      )}
    </div>
  );
}
