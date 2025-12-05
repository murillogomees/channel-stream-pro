/**
 * RecommendationsRow - Horizontal scrollable recommendation row
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Star } from 'lucide-react';
import type { RecommendationItem } from '../types';

interface RecommendationsRowProps {
  title: string;
  subtitle?: string;
  items: RecommendationItem[];
  onSelect: (item: RecommendationItem) => void;
  showReason?: boolean;
}

export function RecommendationsRow({ 
  title, 
  subtitle, 
  items, 
  onSelect,
  showReason = false 
}: RecommendationsRowProps) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-muted">
        {items.map((item, index) => (
          <Card
            key={`${item.content_id}-${index}`}
            className="flex-shrink-0 w-[160px] cursor-pointer hover:ring-2 hover:ring-primary transition-all group"
            onClick={() => onSelect(item)}
          >
            <CardContent className="p-0">
              {/* Thumbnail */}
              <div className="relative aspect-video bg-muted rounded-t-lg overflow-hidden">
                {item.content_logo ? (
                  <img
                    src={item.content_logo}
                    alt={item.content_name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                    <Play className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                
                {/* Play overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Play className="h-10 w-10 text-white fill-white" />
                </div>

                {/* Score badge */}
                {item.score > 0.7 && (
                  <Badge 
                    variant="secondary" 
                    className="absolute top-1 right-1 text-xs"
                  >
                    <Star className="h-3 w-3 mr-1 fill-yellow-500 text-yellow-500" />
                    {Math.round(item.score * 100)}%
                  </Badge>
                )}
              </div>

              {/* Info */}
              <div className="p-2">
                <p className="text-sm font-medium truncate" title={item.content_name}>
                  {item.content_name}
                </p>
                {item.content_category && (
                  <p className="text-xs text-muted-foreground truncate">
                    {item.content_category}
                  </p>
                )}
                {showReason && item.reason && (
                  <Badge variant="outline" className="mt-1 text-xs">
                    {item.reason}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default RecommendationsRow;
