/**
 * FavoritesGrid - Grid de favoritos do usuário
 */

import { FavoriteItem } from "@/hooks/useFavorites";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, Heart, Trash2, Film, Tv, Video } from "lucide-react";
import { cn } from "@/lib/utils";

interface FavoritesGridProps {
  favorites: FavoriteItem[];
  onPlay: (item: FavoriteItem) => void;
  onRemove: (item: FavoriteItem) => void;
  title?: string;
  className?: string;
  showTabs?: boolean;
}

export function FavoritesGrid({
  favorites,
  onPlay,
  onRemove,
  title = "Minha Lista",
  className,
  showTabs = true,
}: FavoritesGridProps) {
  // Group by content type
  const groupedFavorites = favorites.reduce((acc, item) => {
    const type = item.content_type || "outros";
    if (!acc[type]) acc[type] = [];
    acc[type].push(item);
    return acc;
  }, {} as Record<string, FavoriteItem[]>);

  const contentTypes = Object.keys(groupedFavorites);

  const getTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "movie":
      case "filme":
        return Film;
      case "series":
      case "série":
        return Tv;
      case "live":
      case "ao vivo":
        return Video;
      default:
        return Heart;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type.toLowerCase()) {
      case "movie":
        return "Filmes";
      case "series":
        return "Séries";
      case "live":
        return "Ao Vivo";
      case "vod":
        return "VOD";
      default:
        return type;
    }
  };

  const renderItem = (item: FavoriteItem) => (
    <Card
      key={item.id}
      className="group relative w-[200px] flex-shrink-0 overflow-hidden border-border/50 hover:border-primary/50 transition-colors cursor-pointer"
      onClick={() => onPlay(item)}
    >
      <CardContent className="p-0">
        {/* Thumbnail */}
        <div className="relative aspect-[2/3] bg-muted">
          {item.content_logo ? (
            <img
              src={item.content_logo}
              alt={item.content_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
              <Heart className="w-12 h-12 text-primary/50" />
            </div>
          )}

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
            <Button
              size="lg"
              className="rounded-full w-12 h-12"
              onClick={(e) => {
                e.stopPropagation();
                onPlay(item);
              }}
            >
              <Play className="w-5 h-5" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(item);
              }}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Remover
            </Button>
          </div>

          {/* Type badge */}
          <div className="absolute top-2 left-2">
            <span className="text-xs bg-black/70 text-white px-2 py-0.5 rounded capitalize">
              {item.content_type}
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="p-3 space-y-1">
          <h3 className="font-medium text-sm truncate" title={item.content_name}>
            {item.content_name}
          </h3>

          {item.content_category && (
            <span className="inline-block text-xs text-muted-foreground">
              {item.content_category}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (favorites.length === 0) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold">{title}</h2>
        </div>

        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Heart className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">
            Você ainda não adicionou nenhum favorito.
          </p>
          <p className="text-sm text-muted-foreground/70">
            Clique no coração em qualquer conteúdo para adicionar à sua lista.
          </p>
        </div>
      </div>
    );
  }

  if (!showTabs || contentTypes.length <= 1) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold">{title}</h2>
          <span className="text-sm text-muted-foreground">({favorites.length})</span>
        </div>

        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-4 pb-4">
            {favorites.map(renderItem)}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center gap-2">
        <Heart className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-semibold">{title}</h2>
        <span className="text-sm text-muted-foreground">({favorites.length})</span>
      </div>

      <Tabs defaultValue={contentTypes[0]} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="all" className="flex items-center gap-2">
            <Heart className="w-4 h-4" />
            Todos
          </TabsTrigger>
          {contentTypes.map((type) => {
            const Icon = getTypeIcon(type);
            return (
              <TabsTrigger key={type} value={type} className="flex items-center gap-2">
                <Icon className="w-4 h-4" />
                {getTypeLabel(type)}
                <span className="text-xs text-muted-foreground">
                  ({groupedFavorites[type].length})
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="all">
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-4 pb-4">
              {favorites.map(renderItem)}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </TabsContent>

        {contentTypes.map((type) => (
          <TabsContent key={type} value={type}>
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex gap-4 pb-4">
                {groupedFavorites[type].map(renderItem)}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
