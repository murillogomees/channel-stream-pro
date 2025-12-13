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

  // Build proxied stream URL to handle CORS/Mixed Content
  const getProxiedUrl = (url: string | undefined): string | null => {
    if (!url) return null;
    
    // Use stream-proxy edge function to bypass CORS and Mixed Content issues
    const proxyBase = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stream-proxy`;
    return `${proxyBase}?url=${encodeURIComponent(url)}`;
  };

  const streamUrl = getProxiedUrl(channel?.original_url);

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
