import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ChannelData {
  id: string;
  name: string;
  tvg_logo?: string | null;
  category_name?: string;
}

interface ChannelGridProps {
  channels: ChannelData[];
  onChannelSelect: (channel: ChannelData) => void;
  isFavorite: (channelId: string) => boolean;
  onToggleFavorite: (channelId: string) => void;
}

export function ChannelGrid({ 
  channels, 
  onChannelSelect, 
  isFavorite, 
  onToggleFavorite 
}: ChannelGridProps) {
  if (channels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <p>Nenhum canal encontrado</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-4">
      {channels.map((channel) => (
        <Card
          key={channel.id}
          className="group relative overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all"
          onClick={() => onChannelSelect(channel)}
        >
          <div className="aspect-square relative bg-muted">
            {channel.tvg_logo ? (
              <img
                src={channel.tvg_logo}
                alt={channel.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-muted-foreground">
                {channel.name.charAt(0).toUpperCase()}
              </div>
            )}
            
            {/* Favorite Button Overlay */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(channel.id);
              }}
            >
              <Heart
                className={cn(
                  "w-4 h-4",
                  isFavorite(channel.id) && "fill-red-500 text-red-500"
                )}
              />
            </Button>
          </div>

          <div className="p-3">
            <h3 className="font-semibold text-sm truncate">{channel.name}</h3>
            {channel.category_name && (
              <p className="text-xs text-muted-foreground truncate mt-1">
                {channel.category_name}
              </p>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
