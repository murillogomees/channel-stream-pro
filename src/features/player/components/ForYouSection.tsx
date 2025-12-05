/**
 * ForYouSection - Personalized "For You" recommendations
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Play, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRecommendations } from '../hooks/useRecommendations';
import { RecommendationsRow } from './RecommendationsRow';
import type { Channel, RecommendationItem } from '../types';

interface ForYouSectionProps {
  allChannels: Channel[];
  onSelect: (contentId: string, contentName: string) => void;
}

export function ForYouSection({ allChannels, onSelect }: ForYouSectionProps) {
  const { 
    groups, 
    forYouMix, 
    seriesContinuations,
    isLoading, 
    refresh 
  } = useRecommendations({ allChannels, enabled: allChannels.length > 0 });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="flex gap-3 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-[160px] h-[140px] bg-muted animate-pulse rounded-lg flex-shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Para Você</h2>
          <Badge variant="secondary" className="text-xs">IA</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={refresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Continue Watching (Series) */}
      {seriesContinuations.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Play className="h-4 w-4" />
              Continuar Assistindo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {seriesContinuations.map((sc) => (
                <div
                  key={sc.nextEpisode.id}
                  className="flex-shrink-0 w-[200px] cursor-pointer group"
                  onClick={() => onSelect(sc.nextEpisode.id, sc.seriesName)}
                >
                  <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                    {sc.nextEpisode.tvg_logo ? (
                      <img
                        src={sc.nextEpisode.tvg_logo}
                        alt={sc.seriesName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                        <Play className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    
                    {/* Progress bar */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                      <div 
                        className="h-full bg-primary" 
                        style={{ width: `${sc.progress}%` }} 
                      />
                    </div>

                    {/* Play overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Play className="h-10 w-10 text-white fill-white" />
                    </div>
                  </div>
                  <div className="mt-2">
                    <p className="text-sm font-medium truncate">{sc.seriesName}</p>
                    <p className="text-xs text-muted-foreground">
                      T{sc.currentSeason} E{sc.currentEpisode + 1}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* For You Mix */}
      {forYouMix.length > 0 && (
        <RecommendationsRow
          title="Mix Para Você"
          subtitle="Baseado no que você assiste"
          items={forYouMix}
          onSelect={(item) => onSelect(item.content_id, item.content_name)}
          showReason
        />
      )}

      {/* Category-based recommendations */}
      {groups.map((group, index) => (
        <RecommendationsRow
          key={`group-${index}`}
          title={group.title}
          subtitle={group.source_content}
          items={group.items}
          onSelect={(item) => onSelect(item.content_id, item.content_name)}
        />
      ))}

      {/* Empty state */}
      {groups.length === 0 && forYouMix.length === 0 && seriesContinuations.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Recomendações personalizadas</h3>
            <p className="text-sm text-muted-foreground">
              Assista mais conteúdo para receber recomendações personalizadas baseadas nos seus gostos.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default ForYouSection;
