/**
 * IPTV Player Page - Shaka Player Enterprise
 * Uses Shaka Player engine with stream-proxy
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { iptvService } from '@/services/iptvService';
import { ShakaPlayerUI } from '@/components/player';
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

  const handleError = (message: string) => {
    console.error('[IPTVPlayer] Error:', message);
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

  if (!channel?.original_url) {
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
      <ShakaPlayerUI
        streamUrl={channel.original_url}
        title={channel.name}
        subtitle={channel.category || undefined}
        brand={{
          name: 'IPTV Link',
          logo: channel.logo_url || undefined,
          primaryColor: 'hsl(var(--primary))'
        }}
        onBack={handleBack}
        onError={handleError}
      />
    </div>
  );
}
