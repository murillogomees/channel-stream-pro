/**
 * HomeView - Dynamic home tab with personalized content
 */

import { memo, useRef, useMemo, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Play, Clock, Tv, Film, PlaySquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { isValidImageUrl } from '@/lib/imageUtils';
import { ContinueWatchingRow } from './ContinueWatchingRow';
import { shuffleArray, createSessionKey } from '../utils/contentRandomizer';
import type { WatchProgress, Channel, RecommendationGroup, RecommendationItem } from '../types';

interface SeriesContinuation {
  seriesName: string;
  nextEpisode: Channel;
  currentSeason: number;
  currentEpisode: number;
  progress: number;
  logo?: string;
}

interface HomeViewProps {
  // Continue Watching
  continueWatchingItems: WatchProgress[];
  loadingContinueWatching: boolean;
  onPlayContinue: (item: WatchProgress) => void;
  onRemoveContinue: (contentId: string) => void;
  
  // Series Continuations
  seriesContinuations: SeriesContinuation[];
  onPlaySeries: (channel: Channel) => void;
  
  // Recommendations
  recommendationGroups: RecommendationGroup[];
  forYouMix: RecommendationItem[];
  loadingRecommendations: boolean;
  onPlayRecommendation: (item: RecommendationItem) => void;
  
  // Generic channel play
  onPlayChannel: (channel: Channel) => void;
  
  // All channels for reference
  allChannels: Channel[];
}

// Horizontal scroll row component
const ContentRow = memo(function ContentRow({
  title,
  subtitle,
  icon: Icon,
  children,
  isEmpty,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  children: React.ReactNode;
  isEmpty?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  if (isEmpty) return null;

  return (
    <section className="py-4 group/section">
      <div className="flex items-center justify-between mb-3 px-4 lg:px-12">
        <div className="flex items-center gap-3">
          {Icon && <Icon className="w-5 h-5 text-primary" />}
          <div>
            <h2 className="text-lg lg:text-xl font-semibold text-foreground">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
        <div className="flex gap-1 opacity-0 group-hover/section:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => scroll('left')}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => scroll('right')}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-3 px-4 lg:px-12 overflow-x-auto scrollbar-hide scroll-smooth pb-2"
      >
        {children}
      </div>
    </section>
  );
});

// Series continuation card
const SeriesContinuationCard = memo(function SeriesContinuationCard({
  item,
  onPlay,
}: {
  item: SeriesContinuation;
  onPlay: () => void;
}) {
  const episodeInfo = parseEpisodeFromChannel(item.nextEpisode.name);
  
  return (
    <div
      className="flex-shrink-0 w-[200px] lg:w-[240px] group/card cursor-pointer"
      onClick={onPlay}
    >
      <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
        {isValidImageUrl(item.logo) || isValidImageUrl(item.nextEpisode.tvg_logo) ? (
          <img
            src={isValidImageUrl(item.logo) ? item.logo : item.nextEpisode.tvg_logo}
            alt={item.seriesName}
            className="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <PlaySquare className="w-12 h-12 text-primary/40" />
          </div>
        )}

        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/card:opacity-100 transition-opacity flex items-center justify-center">
          <Button size="sm" className="gap-1.5">
            <Play className="w-4 h-4 fill-current" />
            Próximo
          </Button>
        </div>

        {/* Badge */}
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-primary text-primary-foreground text-xs font-medium">
          Continuar
        </div>
      </div>

      <div className="mt-2 space-y-0.5">
        <h3 className="font-medium text-foreground text-sm truncate">
          {item.seriesName}
        </h3>
        <p className="text-xs text-muted-foreground">
          {episodeInfo 
            ? `T${episodeInfo.season} E${episodeInfo.episode}` 
            : 'Próximo episódio'}
        </p>
      </div>
    </div>
  );
});

// Recommendation card
const RecommendationCard = memo(function RecommendationCard({
  item,
  onPlay,
}: {
  item: RecommendationItem;
  onPlay: () => void;
}) {
  const typeLabel = item.content_type === 'movie' ? 'Filme' 
    : item.content_type === 'episode' ? 'Série'
    : item.content_type === 'live' ? 'Ao Vivo' : '';

  return (
    <div
      className="flex-shrink-0 w-[160px] lg:w-[180px] group/card cursor-pointer"
      onClick={onPlay}
    >
      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-muted">
        {item.content_logo ? (
          <img
            src={item.content_logo}
            alt={item.content_name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-muted-foreground/20 to-muted-foreground/5 flex items-center justify-center">
            <Film className="w-10 h-10 text-muted-foreground/40" />
          </div>
        )}

        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/card:opacity-100 transition-opacity flex items-center justify-center">
          <Button size="icon" variant="secondary" className="rounded-full h-12 w-12">
            <Play className="w-6 h-6 fill-current" />
          </Button>
        </div>

        {/* Type badge */}
        {typeLabel && (
          <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/70 text-white text-xs">
            {typeLabel}
          </div>
        )}
      </div>

      <div className="mt-2">
        <h3 className="font-medium text-foreground text-sm line-clamp-2 leading-tight">
          {item.content_name}
        </h3>
        {item.content_category && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {item.content_category}
          </p>
        )}
      </div>
    </div>
  );
});

// Loading skeleton
const LoadingSkeleton = () => (
  <div className="space-y-6 py-4">
    {[1, 2, 3].map((i) => (
      <div key={i} className="px-4 lg:px-12">
        <Skeleton className="h-6 w-48 mb-3" />
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3, 4, 5].map((j) => (
            <Skeleton key={j} className="flex-shrink-0 w-[180px] aspect-[2/3] rounded-lg" />
          ))}
        </div>
      </div>
    ))}
  </div>
);

// Helper to parse episode info
function parseEpisodeFromChannel(name: string): { season: number; episode: number } | null {
  let match = name.match(/S(\d{1,2})\s*E(\d{1,3})/i);
  if (match) return { season: parseInt(match[1]), episode: parseInt(match[2]) };
  
  match = name.match(/(\d{1,2})x(\d{1,3})/i);
  if (match) return { season: parseInt(match[1]), episode: parseInt(match[2]) };
  
  return null;
}

export function HomeView({
  continueWatchingItems,
  loadingContinueWatching,
  onPlayContinue,
  onRemoveContinue,
  seriesContinuations,
  onPlaySeries,
  recommendationGroups,
  forYouMix,
  loadingRecommendations,
  onPlayRecommendation,
  onPlayChannel,
  allChannels,
}: HomeViewProps) {
  // Session key for randomization - changes ONLY on mount (not on re-renders)
  const [sessionKey] = useState(() => createSessionKey());
  
  // Check if we have any personalized content
  const hasPersonalizedContent = 
    continueWatchingItems.length > 0 || 
    seriesContinuations.length > 0 || 
    recommendationGroups.length > 0;

  // Helper to detect content type
  const detectContentType = (channel: Channel): 'movie' | 'episode' | 'live' => {
    const url = channel.stream_url?.toLowerCase() || '';
    const name = channel.name?.toLowerCase() || '';
    const group = (channel.group_title || channel.category_name || '').toLowerCase();
    
    const seriesKeywords = ['série', 'series', 'seriado', 'novela', 'temporada', 'season', 'episódio', 'dorama', 'anime'];
    const movieKeywords = ['filme', 'movie', 'cinema', 'vod filme', 'filmes', 'movies', 'film', 'peliculas', 'lançamento'];
    
    // URL-based detection
    if (url.includes('/series/')) return 'episode';
    if (url.includes('/movie/')) return 'movie';
    if (url.includes('/live/')) return 'live';
    
    // Episode pattern in name
    if (/S\d{1,2}\s*E\d{1,3}/i.test(name) || /\d{1,2}x\d{1,3}/i.test(name)) {
      return 'episode';
    }
    
    // Group/category-based
    if (seriesKeywords.some(kw => group.includes(kw)) && !movieKeywords.some(kw => group.includes(kw))) {
      return 'episode';
    }
    if (movieKeywords.some(kw => group.includes(kw))) {
      return 'movie';
    }
    
    return 'live';
  };

  // MEMOIZE shuffled recommendation groups - stable until data changes
  const shuffledRecommendationGroups = useMemo(() => {
    return recommendationGroups.map(group => ({
      ...group,
      items: shuffleArray(group.items.filter(item => item.content_logo)),
    }));
  }, [recommendationGroups, sessionKey]);

  // MEMOIZE shuffled forYouMix - stable until data changes
  const shuffledForYouMix = useMemo(() => {
    return shuffleArray(forYouMix.filter(item => item.content_logo)).slice(0, 20);
  }, [forYouMix, sessionKey]);

  // Default content sections for new users - RANDOMIZED once per session
  const defaultSections = useMemo(() => {
    if (hasPersonalizedContent || allChannels.length === 0) return [];

    // Separate channels by content type - only with cover images
    const movies: Channel[] = [];
    const series: Channel[] = [];
    const live: Channel[] = [];
    
    for (const ch of allChannels) {
      if (!isValidImageUrl(ch.tvg_logo)) continue; // Skip channels without valid cover image
      const type = detectContentType(ch);
      if (type === 'movie') movies.push(ch);
      else if (type === 'episode') series.push(ch);
      else live.push(ch);
    }

    const sections: { title: string; icon: React.ElementType; channels: Channel[]; type: string }[] = [];
    
    // RANDOMIZE and take different content each time
    if (live.length > 0) {
      sections.push({
        title: '📺 TV ao Vivo',
        icon: Tv,
        channels: shuffleArray(live).slice(0, 20),
        type: 'live',
      });
    }
    
    if (movies.length > 0) {
      sections.push({
        title: '🎬 Filmes',
        icon: Film,
        channels: shuffleArray(movies).slice(0, 20),
        type: 'movie',
      });
    }
    
    if (series.length > 0) {
      // Group series episodes by series name
      const seriesMap = new Map<string, Channel>();
      for (const ch of series) {
        const seriesName = ch.name
          .replace(/\s*S\d{1,2}\s*E\d{1,3}.*/gi, '')
          .replace(/\s*\d{1,2}x\d{1,3}.*/gi, '')
          .replace(/\s*Temporada\s*\d+.*/gi, '')
          .trim();
        if (!seriesMap.has(seriesName)) {
          seriesMap.set(seriesName, ch);
        }
      }
      
      sections.push({
        title: '📺 Séries',
        icon: PlaySquare,
        channels: shuffleArray(Array.from(seriesMap.values())).slice(0, 20),
        type: 'episode',
      });
    }

    return sections;
  }, [allChannels, hasPersonalizedContent, sessionKey]); // sessionKey forces new random on each mount

  if (loadingContinueWatching && loadingRecommendations) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="pb-8 space-y-2">
      {/* Continue Watching - only items with cover images */}
      {continueWatchingItems.filter(item => item.content_logo).length > 0 && (
        <ContinueWatchingRow
          items={continueWatchingItems.filter(item => item.content_logo)}
          onPlay={onPlayContinue}
          onRemove={onRemoveContinue}
          isLoading={loadingContinueWatching}
        />
      )}

      {/* Series Continuations - Next Episodes - only with cover images */}
      {seriesContinuations.filter(item => isValidImageUrl(item.logo) || isValidImageUrl(item.nextEpisode.tvg_logo)).length > 0 && (
        <ContentRow
          title="Continuar Séries"
          subtitle="Próximos episódios das suas séries"
          icon={PlaySquare}
          isEmpty={false}
        >
          {seriesContinuations.filter(item => isValidImageUrl(item.logo) || isValidImageUrl(item.nextEpisode.tvg_logo)).map((item) => (
            <SeriesContinuationCard
              key={item.seriesName}
              item={item}
              onPlay={() => onPlaySeries(item.nextEpisode)}
            />
          ))}
        </ContentRow>
      )}

      {/* Recommendation Groups - STABLE MEMOIZED (no re-shuffle on re-render) */}
      {shuffledRecommendationGroups.map((group) => {
        if (group.items.length === 0) return null;
        return (
          <ContentRow
            key={group.type + (group.source_content || '')}
            title={group.title}
            icon={Clock}
            isEmpty={false}
          >
            {group.items.map((item) => (
              <RecommendationCard
                key={item.id}
                item={item}
                onPlay={() => onPlayRecommendation(item)}
              />
            ))}
          </ContentRow>
        );
      })}

      {/* For You Mix - STABLE MEMOIZED (no re-shuffle on re-render) */}
      {shuffledForYouMix.length > 0 && (
        <ContentRow
          title="Para Você"
          subtitle="Seleção personalizada"
          icon={Film}
          isEmpty={false}
        >
          {shuffledForYouMix.map((item) => (
            <RecommendationCard
              key={item.id}
              item={item}
              onPlay={() => onPlayRecommendation(item)}
            />
          ))}
        </ContentRow>
      )}

      {/* Default sections for new users without watch history */}
      {!hasPersonalizedContent && defaultSections.map((section) => (
        <ContentRow
          key={section.title}
          title={section.title}
          icon={section.icon}
          isEmpty={section.channels.length === 0}
        >
          {section.channels.map((channel) => (
            <div
              key={channel.id}
              className="flex-shrink-0 w-[160px] lg:w-[180px] group/card cursor-pointer"
              onClick={() => onPlayChannel(channel)}
            >
              <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-muted">
                {isValidImageUrl(channel.tvg_logo) ? (
                  <img
                    src={channel.tvg_logo}
                    alt={channel.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-muted-foreground/20 to-muted-foreground/5 flex items-center justify-center">
                    <section.icon className="w-10 h-10 text-muted-foreground/40" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/card:opacity-100 transition-opacity flex items-center justify-center">
                  <Button size="icon" variant="secondary" className="rounded-full h-12 w-12">
                    <Play className="w-6 h-6 fill-current" />
                  </Button>
                </div>
              </div>
              <div className="mt-2">
                <h3 className="font-medium text-foreground text-sm line-clamp-2 leading-tight">
                  {channel.name}
                </h3>
              </div>
            </div>
          ))}
        </ContentRow>
      ))}

      {/* Empty state */}
      {!hasPersonalizedContent && defaultSections.length === 0 && !loadingRecommendations && (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
          <Tv className="w-16 h-16 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            Comece a assistir
          </h3>
          <p className="text-muted-foreground max-w-md">
            Explore as categorias para descobrir conteúdos. Suas recomendações personalizadas aparecerão aqui.
          </p>
        </div>
      )}
    </div>
  );
}

export default memo(HomeView);
