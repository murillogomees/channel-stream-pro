/**
 * Channel List Container
 * 
 * Wrapper component that integrates InfiniteChannelList with
 * useChannelBatchFetch hook for complete channel list solution.
 * 
 * Usage:
 * <ChannelListContainer 
 *   onChannelSelect={handleSelect}
 *   height={600}
 * />
 */

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { InfiniteChannelList, InfiniteChannelListRef, Channel } from './InfiniteChannelList';
import { useChannelBatchFetch } from '@/hooks/useChannelBatchFetch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ChannelListContainerProps {
  userId?: string;
  sourceId?: string;
  batchSize?: number;
  onChannelSelect: (channel: Channel) => void;
  selectedChannelId?: string;
  className?: string;
  height?: number | string;
  showSearch?: boolean;
  showGroupFilter?: boolean;
  showRefresh?: boolean;
}

export const ChannelListContainer = React.forwardRef<InfiniteChannelListRef, ChannelListContainerProps>(({
  userId,
  sourceId,
  batchSize = 500,
  onChannelSelect,
  selectedChannelId,
  className,
  height = '100%',
  showSearch = true,
  showGroupFilter = true,
  showRefresh = true,
}, ref) => {
  const { toast } = useToast();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [recentIds, setRecentIds] = useState<Set<string>>(new Set());

  // Fetch channels with batch loading
  const {
    channels,
    totalCount,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    isCached,
    loadMore,
    refresh,
  } = useChannelBatchFetch({
    userId,
    sourceId,
    batchSize,
    enabled: true,
  });

  // Load favorites from database
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: favorites } = await supabase
          .from('favorites')
          .select('content_id')
          .eq('profile_id', user.id)
          .eq('content_type', 'channel');

        if (favorites) {
          setFavoriteIds(new Set(favorites.map(f => f.content_id)));
        }
      } catch (error) {
        console.error('Failed to load favorites:', error);
      }
    };

    loadFavorites();
  }, []);

  // Load recent channels
  useEffect(() => {
    const loadRecent = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: recent } = await supabase
          .from('channel_usage_stats')
          .select('channel_id')
          .eq('profile_id', user.id)
          .order('last_watched_at', { ascending: false })
          .limit(20);

        if (recent) {
          setRecentIds(new Set(recent.map(r => r.channel_id)));
        }
      } catch (error) {
        console.error('Failed to load recent:', error);
      }
    };

    loadRecent();
  }, []);

  // Handle favorite toggle
  const handleFavoriteToggle = useCallback(async (channel: Channel) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Login necessário",
          description: "Faça login para adicionar favoritos",
          variant: "destructive",
        });
        return;
      }

      const isFavorite = favoriteIds.has(channel.id);

      if (isFavorite) {
        // Remove favorite
        await supabase
          .from('favorites')
          .delete()
          .eq('profile_id', user.id)
          .eq('content_id', channel.id);

        setFavoriteIds(prev => {
          const next = new Set(prev);
          next.delete(channel.id);
          return next;
        });

        toast({
          title: "Removido dos favoritos",
          description: channel.name,
        });
      } else {
        // Add favorite
        await supabase
          .from('favorites')
          .insert({
            profile_id: user.id,
            content_id: channel.id,
            content_name: channel.name,
            content_type: 'channel',
            content_logo: channel.tvg_logo,
            content_category: channel.category_name || channel.group_title,
          });

        setFavoriteIds(prev => new Set([...prev, channel.id]));

        toast({
          title: "Adicionado aos favoritos",
          description: channel.name,
        });
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar favoritos",
        variant: "destructive",
      });
    }
  }, [favoriteIds, toast]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    await refresh();
    toast({
      title: "Lista atualizada",
      description: isCached ? "Carregado do cache" : "Sincronizado com servidor",
    });
  }, [refresh, toast, isCached]);

  // Show error toast
  useEffect(() => {
    if (error) {
      toast({
        title: "Erro ao carregar canais",
        description: error,
        variant: "destructive",
      });
    }
  }, [error, toast]);

  return (
    <InfiniteChannelList
      ref={ref}
      channels={channels}
      totalCount={totalCount}
      isLoading={isLoading}
      isLoadingMore={isLoadingMore}
      hasMore={hasMore}
      selectedChannelId={selectedChannelId}
      favoriteIds={favoriteIds}
      recentIds={recentIds}
      onChannelSelect={onChannelSelect}
      onFavoriteToggle={handleFavoriteToggle}
      onLoadMore={loadMore}
      onRefresh={handleRefresh}
      className={className}
      height={height}
      showSearch={showSearch}
      showGroupFilter={showGroupFilter}
      showRefresh={showRefresh}
    />
  );
});

ChannelListContainer.displayName = 'ChannelListContainer';

export default ChannelListContainer;
