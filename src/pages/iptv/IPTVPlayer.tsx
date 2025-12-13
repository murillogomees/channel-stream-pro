/**
 * IPTV Player Page - Uses White-Label Player
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { iptvService } from '@/services/iptvService';
import { IPTVPlayerWhiteLabel } from '@/components/player/IPTVPlayerWhiteLabel';
import { Loader2 } from 'lucide-react';

export default function IPTVPlayer() {
  const { channelId } = useParams<{ channelId: string }>();
  const navigate = useNavigate();

  // Fetch channel info
  const { data: channel, isLoading: isLoadingChannel } = useQuery({
    queryKey: ['iptv-channel', channelId],
    queryFn: () => iptvService.getChannel(Number(channelId)),
    enabled: !!channelId,
  });

  // Fetch playback URL
  const { data: playbackInfo, isLoading: isLoadingPlayback, refetch: refetchPlayback } = useQuery({
    queryKey: ['iptv-playback', channelId],
    queryFn: () => iptvService.getPlaybackUrl(Number(channelId)),
    enabled: !!channelId,
    staleTime: 30 * 60 * 1000, // 30 min
  });

  const handleBack = () => {
    navigate('/app/home');
  };

  const handleError = (error: string) => {
    console.error('[IPTVPlayer] Error:', error);
  };

  if (isLoadingChannel || isLoadingPlayback) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-white">Conectando ao canal...</p>
        </div>
      </div>
    );
  }

  // Get stream URL - prefer proxy URL, fallback to original
  const streamUrl = playbackInfo?.url || channel?.original_url;

  if (!streamUrl) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-white">Canal não disponível</p>
        </div>
      </div>
    );
  }

  return (
    <IPTVPlayerWhiteLabel
      url={streamUrl}
      branding={{
        name: channel?.name || 'IPTV Link',
        logoUrl: channel?.logo_url,
        isLive: channel?.content_type === 'live',
        category: channel?.category,
      }}
      onBack={handleBack}
      onError={handleError}
      autoPlay
    />
  );
}
