/**
 * PlayerHome - Netflix-style IPTV Home Screen
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

// Feature imports
import {
  useContinueWatching,
  useTrending,
  useRecommendations,
} from '@/features/player/hooks';
import {
  TVHeroCarousel,
  ContinueWatchingRow,
  Top10Row,
  ContentRow,
} from '@/features/player/components';
import { favoritesService, watchProgressService } from '@/features/player/services';
import type { 
  WatchProgress, 
  TrendingItem, 
  RecommendationItem,
  ContentType 
} from '@/features/player/types';

// Placeholder content for hero (will be replaced with real data)
const HERO_ITEMS = [
  {
    id: '1',
    title: 'Oppenheimer',
    description: 'A história do físico J. Robert Oppenheimer e seu papel no desenvolvimento da bomba atômica durante a Segunda Guerra Mundial.',
    backdrop_url: 'https://image.tmdb.org/t/p/original/fm6KqXpk3M2HVveHwCrBSSBaO0V.jpg',
    content_type: 'movie' as ContentType,
    year: 2023,
    rating: 8.5,
    genres: ['Drama', 'História', 'Suspense'],
  },
  {
    id: '2',
    title: 'Duna: Parte Dois',
    description: 'Paul Atreides se une a Chani e aos Fremen enquanto busca vingança contra os conspiradores que destruíram sua família.',
    backdrop_url: 'https://image.tmdb.org/t/p/original/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg',
    content_type: 'movie' as ContentType,
    year: 2024,
    rating: 8.8,
    genres: ['Ficção Científica', 'Aventura'],
  },
  {
    id: '3',
    title: 'The Last of Us',
    description: 'Joel e Ellie atravessam os Estados Unidos destruídos por uma pandemia em uma jornada de sobrevivência.',
    backdrop_url: 'https://image.tmdb.org/t/p/original/uDgy6hyPd82kOHh6I95FLtLnj6p.jpg',
    content_type: 'series' as ContentType,
    year: 2023,
    rating: 8.8,
    genres: ['Drama', 'Ação', 'Aventura'],
  },
];

export default function PlayerHome() {
  const navigate = useNavigate();
  
  // Data hooks
  const { items: continueWatching, isLoading: loadingContinue, removeItem } = useContinueWatching();
  const { items: trendingItems, isLoading: loadingTrending } = useTrending('weekly');
  const { groups: recommendations, isLoading: loadingRecommendations } = useRecommendations();

  // Handlers
  const handlePlayHero = useCallback((item: typeof HERO_ITEMS[0]) => {
    navigate(`/app/player?id=${item.id}&type=${item.content_type}&name=${encodeURIComponent(item.title)}`);
  }, [navigate]);

  const handleInfoHero = useCallback((item: typeof HERO_ITEMS[0]) => {
    toast.info(`Detalhes de: ${item.title}`, {
      description: 'Modal de detalhes em desenvolvimento',
    });
  }, []);

  const handleAddToListHero = useCallback(async (item: typeof HERO_ITEMS[0]) => {
    try {
      await favoritesService.addToWatchlist(item.id, item.content_type, item.title, {
        contentLogo: item.backdrop_url,
      });
      toast.success('Adicionado à Minha Lista');
    } catch (error) {
      toast.error('Erro ao adicionar à lista');
    }
  }, []);

  const handlePlayContinue = useCallback((item: WatchProgress) => {
    navigate(`/app/player?id=${item.content_id}&type=${item.content_type}&name=${encodeURIComponent(item.content_name)}&resume=${item.progress_seconds}`);
  }, [navigate]);

  const handleRemoveContinue = useCallback(async (contentId: string) => {
    try {
      await removeItem(contentId);
      toast.success('Removido de Continuar Assistindo');
    } catch (error) {
      toast.error('Erro ao remover');
    }
  }, [removeItem]);

  const handlePlayTrending = useCallback((item: TrendingItem) => {
    navigate(`/app/player?id=${item.content_id}&type=${item.content_type}&name=${encodeURIComponent(item.content_name)}`);
  }, [navigate]);

  const handleInfoTrending = useCallback((item: TrendingItem) => {
    toast.info(`Detalhes de: ${item.content_name}`, {
      description: 'Modal de detalhes em desenvolvimento',
    });
  }, []);

  const handlePlayRecommendation = useCallback((item: RecommendationItem) => {
    navigate(`/app/player?id=${item.content_id}&type=${item.content_type}&name=${encodeURIComponent(item.content_name)}`);
  }, [navigate]);

  const handleInfoRecommendation = useCallback((item: RecommendationItem) => {
    toast.info(`Detalhes de: ${item.content_name}`, {
      description: 'Modal de detalhes em desenvolvimento',
    });
  }, []);

  const handleAddToListRecommendation = useCallback(async (item: RecommendationItem) => {
    try {
      await favoritesService.addToWatchlist(item.content_id, item.content_type, item.content_name, {
        contentLogo: item.content_logo,
        contentCategory: item.content_category,
      });
      toast.success('Adicionado à Minha Lista');
    } catch (error) {
      toast.error('Erro ao adicionar à lista');
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Carousel */}
      <TVHeroCarousel
        items={HERO_ITEMS}
        onPlay={handlePlayHero}
        onInfo={handleInfoHero}
        onAddToList={handleAddToListHero}
      />

      {/* Content Sections */}
      <div className="relative z-10 -mt-20 pb-20 space-y-2">
        {/* Continue Watching */}
        <ContinueWatchingRow
          items={continueWatching}
          onPlay={handlePlayContinue}
          onRemove={handleRemoveContinue}
          isLoading={loadingContinue}
        />

        {/* Top 10 */}
        <Top10Row
          items={trendingItems}
          title="Top 10 da Semana"
          onPlay={handlePlayTrending}
          onInfo={handleInfoTrending}
          isLoading={loadingTrending}
        />

        {/* Recommendation Groups */}
        {recommendations.map((group) => (
          <ContentRow
            key={group.type}
            title={group.title}
            items={group.items}
            onPlay={handlePlayRecommendation}
            onInfo={handleInfoRecommendation}
            onAddToList={handleAddToListRecommendation}
            isLoading={loadingRecommendations}
            variant="poster"
          />
        ))}

        {/* Fallback rows when no personalized recommendations */}
        {!loadingRecommendations && recommendations.length === 0 && (
          <>
            <ContentRow
              title="Em Alta"
              items={trendingItems.map(t => ({
                id: t.id,
                content_id: t.content_id,
                content_type: t.content_type,
                content_name: t.content_name,
                content_logo: t.content_logo,
                content_category: t.content_category,
                score: t.score,
              }))}
              onPlay={handlePlayRecommendation}
              onInfo={handleInfoRecommendation}
              onAddToList={handleAddToListRecommendation}
              variant="backdrop"
            />
          </>
        )}
      </div>
    </div>
  );
}
