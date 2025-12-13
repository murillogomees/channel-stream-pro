/**
 * IPTV Player Page - Uses White-Label Player with CDN Fallback
 */

import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { iptvService } from '@/services/iptvService';
import { IPTVPlayerWhiteLabel } from '@/components/player/IPTVPlayerWhiteLabel';
import { Loader2 } from 'lucide-react';

export default function IPTVPlayer() {
  const { channelId } = useParams<{ channelId: string }>();
  const navigate = useNavigate();
  
  // Track current stream URL index for fallback
  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);

  // Fetch channel info
  const { data: channel, isLoading: isLoadingChannel } = useQuery({
    queryKey: ['iptv-channel', channelId],
    queryFn: () => iptvService.getChannel(Number(channelId)),
    enabled: !!channelId,
  });

  // Fetch playback URL
  const { data: playbackInfo, isLoading: isLoadingPlayback } = useQuery({
    queryKey: ['iptv-playback', channelId],
    queryFn: () => iptvService.getPlaybackUrl(Number(channelId)),
    enabled: !!channelId,
    staleTime: 30 * 60 * 1000, // 30 min
  });

  const handleBack = () => {
    navigate('/app/home');
  };

  // Get list of available URLs (prioritize origin over proxy)
  const getStreamUrls = useCallback(() => {
    const urls: string[] = [];

    // Add CDN list URLs if available, but prefer type "origin" first
    if (playbackInfo?.cdnList && Array.isArray(playbackInfo.cdnList)) {
      const sortedCdns = [...playbackInfo.cdnList].sort((a, b) => {
        // Origin first, then others by priority
        if (a.type === 'origin' && b.type !== 'origin') return -1;
        if (a.type !== 'origin' && b.type === 'origin') return 1;
        return (a.priority || 0) - (b.priority || 0);
      });

      sortedCdns.forEach((cdn) => {
        if (cdn.url && !urls.includes(cdn.url)) {
          urls.push(cdn.url);
        }
      });
    }

    // Fallback to primary playback URL (only if not already added)
    if (playbackInfo?.url && !urls.includes(playbackInfo.url)) {
      urls.push(playbackInfo.url);
    }

    // Last resort: original channel URL
    if (channel?.original_url && !urls.includes(channel.original_url)) {
      urls.unshift(channel.original_url);
    }

    return urls;
  }, [playbackInfo, channel]);

  // Handle player error - try next URL in list
  const handleError = useCallback((error: string) => {
    console.error('[IPTVPlayer] Error:', error);
    
    const urls = getStreamUrls();
    const nextIndex = currentUrlIndex + 1;
    
    // If there are more URLs to try, switch to next
    if (nextIndex < urls.length) {
      console.log(`[IPTVPlayer] Trying fallback URL ${nextIndex + 1}/${urls.length}`);
      setCurrentUrlIndex(nextIndex);
    }
  }, [currentUrlIndex, getStreamUrls]);

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

  // Get current stream URL from ordered list
  const streamUrls = getStreamUrls();
  const streamUrl = streamUrls[currentUrlIndex];

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
      key={currentUrlIndex} // Force remount on URL change
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
