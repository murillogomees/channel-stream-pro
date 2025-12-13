/**
 * IPTV Player Page - Direct playback using original_url
 * Avoids proxy issues with Xtream servers
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
  const { data: channel, isLoading } = useQuery({
    queryKey: ['iptv-channel', channelId],
    queryFn: () => iptvService.getChannel(Number(channelId)),
    enabled: !!channelId,
  });

  const handleBack = () => {
    navigate('/app/home');
  };

  const handleError = (error: string) => {
    console.error('[IPTVPlayer] Playback error:', error);
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

  // Use original_url directly - avoids 502 from stream-proxy
  const streamUrl = channel?.original_url || null;

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
