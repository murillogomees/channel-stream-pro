/**
 * IPTV Player Page - Fully Responsive
 * Adapts to mobile, tablet, desktop, and TV screens
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
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 animate-spin text-primary mx-auto" />
          <p className="text-white text-sm sm:text-base">Conectando ao canal...</p>
        </div>
      </div>
    );
  }

  if (!channel?.original_url) {
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

  return (
    <div className="fixed inset-0 bg-black">
      {/* Player container - responsive aspect ratio */}
      <div className="w-full h-full">
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
    </div>
  );
}
