/**
 * IPTV Player Page - Enterprise V2
 * Uses stream-proxy for all requests
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { iptvService } from '@/services/iptvService';
import { IPTVPlayerWhiteLabelV2 } from '@/components/player/IPTVPlayerWhiteLabelV2';
import { Loader2 } from 'lucide-react';

export default function IPTVPlayer() {
  const { channelId } = useParams<{ channelId: string }>();
  const navigate = useNavigate();

  const { data: channel, isLoading } = useQuery({
    queryKey: ['iptv-channel', channelId],
    queryFn: () => iptvService.getChannel(Number(channelId)),
    enabled: !!channelId,
  });

  const handleBack = () => {
    navigate('/app/home');
  };

  const handleError = (error: string) => {
    console.error('[IPTVPlayer] Error:', error);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-white">Conectando ao canal...</p>
        </div>
      </div>
    );
  }

  const streamUrl = channel?.original_url;

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
    <div className="min-h-screen bg-black">
      <IPTVPlayerWhiteLabelV2
        url={streamUrl}
        channelName={channel?.name}
        channelLogo={channel?.logo_url}
        category={channel?.category}
        isLive={channel?.content_type === 'live'}
        onBack={handleBack}
        onError={handleError}
        autoPlay
        lowLatency
      />
    </div>
  );
}
