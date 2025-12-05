/**
 * TrendingSection - Display trending content with rankings
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, Play, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { useTrending } from '../hooks/useTrending';
import type { TrendingItem, RankingType } from '../types';

interface TrendingSectionProps {
  onSelect: (contentId: string, contentName: string) => void;
}

export function TrendingSection({ onSelect }: TrendingSectionProps) {
  const [rankingType, setRankingType] = useState<RankingType>('weekly');
  const { items, isLoading } = useTrending(rankingType, undefined, 10);

  const RankChangeIcon = ({ change }: { change: number }) => {
    if (change > 0) return <ArrowUp className="h-3 w-3 text-green-500" />;
    if (change < 0) return <ArrowDown className="h-3 w-3 text-red-500" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  const formatViews = (views: number | null) => {
    if (!views) return '0';
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
    return views.toString();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Em Alta
          </CardTitle>
          <Tabs value={rankingType} onValueChange={(v) => setRankingType(v as RankingType)}>
            <TabsList className="h-8">
              <TabsTrigger value="daily" className="text-xs px-2">Hoje</TabsTrigger>
              <TabsTrigger value="weekly" className="text-xs px-2">Semana</TabsTrigger>
              <TabsTrigger value="monthly" className="text-xs px-2">Mês</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum dado de trending disponível
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors group"
                onClick={() => onSelect(item.content_id, item.content_name)}
              >
                {/* Rank */}
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                  {item.rank_position}
                </div>

                {/* Thumbnail */}
                <div className="relative w-16 h-10 rounded overflow-hidden bg-muted flex-shrink-0">
                  {item.content_logo ? (
                    <img
                      src={item.content_logo}
                      alt={item.content_name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Play className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play className="h-4 w-4 text-white fill-white" />
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.content_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatViews(item.view_count)} visualizações
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default TrendingSection;
