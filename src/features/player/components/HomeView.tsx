/**
 * HomeView - Optimized home tab with personalized content
 * 
 * Features:
 * - Hero header image
 * - Most viewed content by user
 * - Recommendations based on viewing history
 * - Maximum 500 content items (loaded independently)
 */

import { memo, useRef, useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Play, Clock, Tv, Film, PlaySquare, Sparkles, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { isValidImageUrl } from '@/lib/imageUtils';
import { ContinueWatchingRow } from './ContinueWatchingRow';
import { createSessionKey } from '../utils/contentRandomizer';
import { usePersonalizedContent } from '../hooks/usePersonalizedContent';
import { useHomeChannels } from '@/hooks/useHomeChannels';
import homeHeroImage from '@/assets/home-hero.png';
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
  continueWatchingItems: WatchProgress[];
  loadingContinueWatching: boolean;
  onPlayContinue: (item: WatchProgress) => void;
  onRemoveContinue: (contentId: string) => void;
  seriesContinuations: SeriesContinuation[];
  onPlaySeries: (channel: Channel) => void;
  recommendationGroups: RecommendationGroup[];
  forYouMix: RecommendationItem[];
  loadingRecommendations: boolean;
  onPlayRecommendation: (item: RecommendationItem) => void;
  onPlayChannel: (channel: Channel) => void;
  allChannels?: Channel[]; // Now optional - we use our own limited hook
}

// Horizontal scroll row component
const ContentRow = memo(function ContentRow({
  title,
  subtitle,
  icon: Icon,
  children,
  isEmpty,
  badge
}: {
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  children: React.ReactNode;
  isEmpty?: boolean;
  badge?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };
  if (isEmpty) return null;
  return <section className="py-2 sm:py-4 group/section">
      <div className="flex items-center justify-between mb-2 sm:mb-3 px-2 sm:px-4 lg:px-12">
        <div className="flex items-center gap-2 sm:gap-3">
          {Icon && <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />}
          <div className="flex items-center gap-1 sm:gap-2">
            <h2 className="text-sm sm:text-lg lg:text-xl font-semibold text-foreground">
              {title}
            </h2>
            {badge && <span className="px-1 sm:px-1.5 py-0.5 text-[8px] sm:text-[10px] font-medium bg-primary/10 text-primary rounded">
                {badge}
              </span>}
          </div>
          {subtitle && <p className="text-xs text-muted-foreground hidden sm:block">{subtitle}</p>}
        </div>
        <div className="flex gap-1 opacity-0 group-hover/section:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-6 w-6 sm:h-7 sm:w-7" onClick={() => scroll('left')}>
            <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 sm:h-7 sm:w-7" onClick={() => scroll('right')}>
            <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
          </Button>
        </div>
      </div>

      <div ref={scrollRef} className="flex gap-2 sm:gap-3 px-2 sm:px-4 lg:px-12 overflow-x-auto scrollbar-hide scroll-smooth pb-2">
        {children}
      </div>
    </section>;
});

// Series continuation card
const SeriesContinuationCard = memo(function SeriesContinuationCard({
  item,
  onPlay
}: {
  item: SeriesContinuation;
  onPlay: () => void;
}) {
  const episodeInfo = parseEpisodeFromChannel(item.nextEpisode.name);
  return <div className="flex-shrink-0 w-[120px] sm:w-[160px] lg:w-[200px] group/card cursor-pointer" onClick={onPlay}>
      <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
        {isValidImageUrl(item.logo) || isValidImageUrl(item.nextEpisode.tvg_logo) ? <img src={isValidImageUrl(item.logo) ? item.logo : item.nextEpisode.tvg_logo} alt={item.seriesName} className="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-105" loading="lazy" /> : <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <PlaySquare className="w-8 h-8 sm:w-12 sm:h-12 text-primary/40" />
          </div>}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/card:opacity-100 transition-opacity flex items-center justify-center">
          <Button size="sm" className="gap-1 sm:gap-1.5 text-xs sm:text-sm h-7 sm:h-8">
            <Play className="w-3 h-3 sm:w-4 sm:h-4 fill-current" />
            <span className="hidden sm:inline">Continuar</span>
          </Button>
        </div>
        <div className="absolute top-1 left-1 sm:top-2 sm:left-2 px-1 sm:px-2 py-0.5 rounded bg-primary text-primary-foreground text-[10px] sm:text-xs font-medium">
          Próximo
        </div>
      </div>
      <div className="mt-1 sm:mt-2 space-y-0.5">
        <h3 className="font-medium text-foreground text-xs sm:text-sm truncate">{item.seriesName}</h3>
        <p className="text-[10px] sm:text-xs text-muted-foreground">
          {episodeInfo ? `T${episodeInfo.season} E${episodeInfo.episode}` : 'Próximo episódio'}
        </p>
      </div>
    </div>;
});

// Recommendation card
const RecommendationCard = memo(function RecommendationCard({
  item,
  onPlay
}: {
  item: RecommendationItem;
  onPlay: () => void;
}) {
  const typeLabel = item.content_type === 'movie' ? 'Filme' : item.content_type === 'episode' ? 'Série' : item.content_type === 'live' ? 'Ao Vivo' : '';
  return <div className="flex-shrink-0 w-[100px] sm:w-[130px] lg:w-[160px] group/card cursor-pointer" onClick={onPlay}>
      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-muted">
        {item.content_logo ? <img src={item.content_logo} alt={item.content_name} className="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-105" loading="lazy" /> : <div className="w-full h-full bg-gradient-to-br from-muted-foreground/20 to-muted-foreground/5 flex items-center justify-center">
            <Film className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 text-muted-foreground/40" />
          </div>}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/card:opacity-100 transition-opacity flex items-center justify-center">
          <Button size="icon" variant="secondary" className="rounded-full h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12">
            <Play className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 fill-current" />
          </Button>
        </div>
        {typeLabel && <div className="absolute top-1 left-1 sm:top-2 sm:left-2 px-1 sm:px-1.5 py-0.5 rounded bg-black/70 text-white text-[9px] sm:text-xs">
            {typeLabel}
          </div>}
      </div>
      <div className="mt-1 sm:mt-2">
        <h3 className="font-medium text-foreground text-[10px] sm:text-xs lg:text-sm line-clamp-2 leading-tight">
          {item.content_name}
        </h3>
        {item.content_category && <p className="text-[9px] sm:text-xs text-muted-foreground mt-0.5 truncate hidden sm:block">{item.content_category}</p>}
      </div>
    </div>;
});

// Channel card for default sections
const ChannelCard = memo(function ChannelCard({
  channel,
  onPlay,
  icon: Icon
}: {
  channel: Channel;
  onPlay: () => void;
  icon?: React.ElementType;
}) {
  return <div className="flex-shrink-0 w-[100px] sm:w-[130px] lg:w-[160px] group/card cursor-pointer" onClick={onPlay}>
      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-muted">
        {isValidImageUrl(channel.tvg_logo) ? <img src={channel.tvg_logo} alt={channel.name} className="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-105" loading="lazy" /> : <div className="w-full h-full bg-gradient-to-br from-muted-foreground/20 to-muted-foreground/5 flex items-center justify-center">
            {Icon ? <Icon className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 text-muted-foreground/40" /> : <Film className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 text-muted-foreground/40" />}
          </div>}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/card:opacity-100 transition-opacity flex items-center justify-center">
          <Button size="icon" variant="secondary" className="rounded-full h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12">
            <Play className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 fill-current" />
          </Button>
        </div>
      </div>
      <div className="mt-1 sm:mt-2">
        <h3 className="font-medium text-foreground text-[10px] sm:text-xs lg:text-sm line-clamp-2 leading-tight">{channel.name}</h3>
      </div>
    </div>;
});

// Hero Header component - compact for mobile
const HeroHeader = memo(function HeroHeader({ className }: { className?: string }) {
  return <div className={cn("relative w-full overflow-hidden", className)}>
      <img src={homeHeroImage} alt="IPTV Link" className="w-full h-full object-cover object-center" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
    </div>;
});

// Loading skeleton
const LoadingSkeleton = () => <div className="space-y-6 py-4">
    <Skeleton className="w-full aspect-[21/9] md:aspect-[3/1]" />
    {[1, 2, 3].map(i => <div key={i} className="px-4 lg:px-12">
        <Skeleton className="h-6 w-48 mb-3" />
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3, 4, 5].map(j => <Skeleton key={j} className="flex-shrink-0 w-[180px] aspect-[2/3] rounded-lg" />)}
        </div>
      </div>)}
  </div>;

// Helper to parse episode info
function parseEpisodeFromChannel(name: string): {
  season: number;
  episode: number;
} | null {
  let match = name.match(/S(\d{1,2})\s*E(\d{1,3})/i);
  if (match) return {
    season: parseInt(match[1]),
    episode: parseInt(match[2])
  };
  match = name.match(/(\d{1,2})x(\d{1,3})/i);
  if (match) return {
    season: parseInt(match[1]),
    episode: parseInt(match[2])
  };
  return null;
}

// Icon map for default sections
const sectionIcons: Record<string, React.ElementType> = {
  live: Tv,
  movie: Film,
  series: PlaySquare
};
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
  allChannels: externalChannels // Renamed - we prefer our own limited channels
}: HomeViewProps) {
  // Session key for stable randomization
  const [sessionKey] = useState(() => createSessionKey());

  // Use our own lightweight hook - loads ONLY 500 channels
  const {
    channels: homeChannels,
    isLoading: loadingHomeChannels
  } = useHomeChannels();

  // Use home channels if available, fallback to external (but limited)
  const limitedChannels = useMemo(() => {
    if (homeChannels.length > 0) {
      return homeChannels as Channel[];
    }
    // Fallback: limit external channels to 500
    return (externalChannels || []).slice(0, 500);
  }, [homeChannels, externalChannels]);

  // Use optimized personalized content hook (max 500 items)
  const {
    continueWatching,
    seriesContinuations: processedSeries,
    relatedGroups,
    forYouMix: processedForYou,
    defaultSections,
    hasPersonalizedContent,
    totalItemCount
  } = usePersonalizedContent({
    continueWatchingItems,
    seriesContinuations,
    recommendationGroups,
    forYouMix,
    allChannels: limitedChannels,
    sessionKey
  });

  if (loadingContinueWatching && loadingRecommendations || loadingHomeChannels) {
    return <LoadingSkeleton />;
  }

  return <div className="pb-20 sm:pb-8 space-y-3 sm:space-y-4">
      {/* Hero Header - Responsive */}
      <HeroHeader className="h-32 sm:h-[180px] md:h-64 lg:h-80 mb-3 sm:mb-4" />

      {/* Continue Watching Row - All devices */}
      {continueWatching.length > 0 && (
        <ContinueWatchingRow items={continueWatching} onPlay={onPlayContinue} onRemove={onRemoveContinue} isLoading={loadingContinueWatching} />
      )}

      {/* Series Continuations - All devices */}
      {processedSeries.length > 0 && (
        <ContentRow title="Continuar Séries" subtitle="Próximos episódios" icon={PlaySquare} isEmpty={false}>
          {processedSeries.map(item => <SeriesContinuationCard key={(item as any)._uniqueKey || item.seriesName} item={item} onPlay={() => onPlaySeries(item.nextEpisode)} />)}
        </ContentRow>
      )}

      {/* Related Content Groups - All devices */}
      {relatedGroups.map(group => <ContentRow key={(group as any)._groupKey || `group-${group.type}`} title={group.title} icon={TrendingUp} badge="Baseado no que você viu" isEmpty={group.items.length === 0}>
          {group.items.map(item => <RecommendationCard key={(item as any)._uniqueKey || item.id || item.content_id} item={item} onPlay={() => onPlayRecommendation(item)} />)}
        </ContentRow>)}

      {/* For You Mix - All devices */}
      {processedForYou.length > 0 && (
        <ContentRow title="Para Você" subtitle="Sugestões personalizadas" icon={Sparkles} badge="IA" isEmpty={false}>
          {processedForYou.map(item => <RecommendationCard key={(item as any)._uniqueKey || item.id || item.content_id} item={item} onPlay={() => onPlayRecommendation(item)} />)}
        </ContentRow>
      )}

      {/* Default sections - All devices */}
      {!hasPersonalizedContent && defaultSections.map(section => <ContentRow key={(section as any)._sectionKey || section.type} title={section.title} icon={sectionIcons[section.type] || Tv} isEmpty={section.channels.length === 0}>
          {section.channels.map(channel => <ChannelCard key={(channel as any)._uniqueKey || channel.id} channel={channel} onPlay={() => onPlayChannel(channel)} icon={sectionIcons[section.type]} />)}
        </ContentRow>)}

      {/* Empty state */}
      {!hasPersonalizedContent && defaultSections.length === 0 && !loadingRecommendations && <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center px-4">
          <Tv className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground/40 mb-3 sm:mb-4" />
          <h3 className="text-base sm:text-lg font-medium text-foreground mb-2">Comece a assistir</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Explore as categorias para descobrir conteúdos.
          </p>
        </div>}
    </div>;
}
export default memo(HomeView);