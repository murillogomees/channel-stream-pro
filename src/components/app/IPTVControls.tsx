import { Heart, Grid3x3, List, Search, ChevronUp, ChevronDown, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface IPTVControlsProps {
  view: 'player' | 'grid' | 'list';
  onViewChange: (view: 'player' | 'grid' | 'list') => void;
  showFavoritesOnly: boolean;
  onToggleFavorites: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onNextChannel: () => void;
  onPreviousChannel: () => void;
  onToggleInfo: () => void;
  showInfo: boolean;
}

export function IPTVControls({
  view,
  onViewChange,
  showFavoritesOnly,
  onToggleFavorites,
  searchQuery,
  onSearchChange,
  onNextChannel,
  onPreviousChannel,
  onToggleInfo,
  showInfo
}: IPTVControlsProps) {
  return (
    <div className="bg-background/95 backdrop-blur-sm border-b border-border p-4">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-4">
        {/* View Toggle */}
        <div className="flex gap-2">
          <Button
            variant={view === 'player' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onViewChange('player')}
          >
            <List className="w-4 h-4 mr-2" />
            Player
          </Button>
          <Button
            variant={view === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onViewChange('grid')}
          >
            <Grid3x3 className="w-4 h-4 mr-2" />
            Grade
          </Button>
        </div>

        {/* Search */}
        <div className="flex-1 min-w-[200px] max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar canais..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Favorites Filter */}
        <Button
          variant={showFavoritesOnly ? 'default' : 'outline'}
          size="sm"
          onClick={onToggleFavorites}
        >
          <Heart className={cn("w-4 h-4 mr-2", showFavoritesOnly && "fill-current")} />
          Favoritos
        </Button>

        {/* Channel Navigation (visible in player view) */}
        {view === 'player' && (
          <>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onPreviousChannel}
              >
                <ChevronUp className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onNextChannel}
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
            </div>

            <Button
              variant={showInfo ? 'default' : 'outline'}
              size="sm"
              onClick={onToggleInfo}
            >
              <Info className="w-4 h-4 mr-2" />
              Info
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
