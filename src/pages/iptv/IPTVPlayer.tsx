/**
 * IPTV Player Page - Enterprise V3
 * Uses stream-proxy with auto token refresh
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { iptvService } from '@/services/iptvService';
import { IPTVPlayerWhiteLabelV3 } from '@/components/player/IPTVPlayerWhiteLabelV3';
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

  // Build proxied URL - token will be injected by PlayerEngineV3
  const getProxiedUrl = (url: string | undefined): string | null => {
    if (!url) return null;
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
    <div className="h-screen w-screen bg-black">
      <IPTVPlayerWhiteLabelV3
        streamUrl={streamUrl}
        title={channel?.name}
        brand={{
          name: 'IPTV Link',
          primaryColor: '#3b82f6'
        }}
        onBack={handleBack}
      />
    </div>
  );
}
