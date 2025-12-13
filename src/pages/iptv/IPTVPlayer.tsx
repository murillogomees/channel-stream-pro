/**
 * IPTV Player Page - Modular White-Label Player
 * Uses custom modular architecture with TokenManager, StreamResolver, etc.
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { iptvService } from '@/services/iptvService';
import { IPTVPlayerWhiteLabel } from '@/components/player';
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
      <IPTVPlayerWhiteLabel
        streamUrl={channel.original_url}
        title={channel.name}
        brand={{
          name: 'IPTV Link',
          logo: channel.logo_url,
          primaryColor: 'hsl(var(--primary))'
        }}
        onBack={handleBack}
        onError={handleError}
      />
    </div>
  );
}
