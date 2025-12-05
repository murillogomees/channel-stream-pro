/**
 * ContinueWatching - Componente para exibir itens em andamento
 */

import { WatchHistoryItem } from "@/hooks/useWatchHistory";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Play, X, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContinueWatchingProps {
  items: WatchHistoryItem[];
  onPlay: (item: WatchHistoryItem) => void;
  onRemove?: (item: WatchHistoryItem) => void;
  title?: string;
  className?: string;
}

export function ContinueWatching({
  items,
  onPlay,
  onRemove,
  title = "Continue Assistindo",
  className,
}: ContinueWatchingProps) {
  if (items.length === 0) return null;

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatRemainingTime = (item: WatchHistoryItem) => {
    if (!item.metadata?.total_duration || !item.duration_seconds) return null;
    
    const remaining = item.metadata.total_duration - item.duration_seconds;
    if (remaining <= 0) return null;
    
    return formatTime(remaining);
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center gap-2">
        <Clock className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>

      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-4 pb-4">
          {items.map((item) => (
            <Card
              key={item.id}
              className="group relative w-[280px] flex-shrink-0 overflow-hidden border-border/50 hover:border-primary/50 transition-colors"
            >
              <CardContent className="p-0">
                {/* Thumbnail */}
                <div className="relative aspect-video bg-muted">
                  {item.content_logo ? (
                    <img
                      src={item.content_logo}
                      alt={item.content_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                      <Play className="w-12 h-12 text-primary/50" />
                    </div>
                  )}

                  {/* Play overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button
                      size="lg"
                      className="rounded-full w-14 h-14"
                      onClick={() => onPlay(item)}
                    >
                      <Play className="w-6 h-6" />
                    </Button>
                  </div>

                  {/* Remove button */}
                  {onRemove && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 w-8 h-8 bg-black/50 hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(item);
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}

                  {/* Progress bar */}
                  <div className="absolute bottom-0 left-0 right-0">
                    <Progress
                      value={item.progress_percent || 0}
                      className="h-1 rounded-none bg-white/20"
                    />
                  </div>
                </div>

                {/* Info */}
                <div className="p-3 space-y-1">
                  <h3 className="font-medium truncate" title={item.content_name}>
                    {item.content_name}
                  </h3>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="capitalize">{item.content_type}</span>
                    
                    {formatRemainingTime(item) && (
                      <span>{formatRemainingTime(item)} restante</span>
                    )}
                  </div>

                  {item.content_category && (
                    <span className="inline-block text-xs bg-muted px-2 py-0.5 rounded">
                      {item.content_category}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
