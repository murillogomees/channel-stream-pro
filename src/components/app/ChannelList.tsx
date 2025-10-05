import { useState } from 'react';
import { Tv, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { Channel } from '@/utils/m3uParser';

interface ChannelListProps {
  channels: Channel[];
  categories: string[];
  selectedChannel?: Channel;
  selectedCategory: string;
  onChannelSelect: (channel: Channel) => void;
  onCategorySelect: (category: string) => void;
  isTVMode?: boolean;
}

export function ChannelList({
  channels,
  categories,
  selectedChannel,
  selectedCategory,
  onChannelSelect,
  onCategorySelect,
  isTVMode = false,
}: ChannelListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredChannels = channels.filter(channel =>
    channel.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Search Bar */}
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar canal..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Categories */}
      <ScrollArea className="border-b">
        <div className="flex gap-2 p-4">
          <Badge
            variant={selectedCategory === 'all' ? 'default' : 'outline'}
            className="cursor-pointer whitespace-nowrap"
            onClick={() => onCategorySelect('all')}
            data-focusable={isTVMode}
            data-focus-id="category-all"
          >
            Todos
          </Badge>
          {categories.map((category) => (
            <Badge
              key={category}
              variant={selectedCategory === category ? 'default' : 'outline'}
              className="cursor-pointer whitespace-nowrap"
              onClick={() => onCategorySelect(category)}
              data-focusable={isTVMode}
              data-focus-id={`category-${category}`}
            >
              {category}
            </Badge>
          ))}
        </div>
      </ScrollArea>

      {/* Channel List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {filteredChannels.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Tv className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum canal encontrado</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredChannels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => onChannelSelect(channel)}
                  data-focusable={isTVMode}
                  data-focus-id={`channel-${channel.id}`}
                  className={`
                    w-full flex items-center gap-3 p-3 rounded-lg text-left
                    transition-colors hover:bg-accent
                    ${selectedChannel?.id === channel.id ? 'bg-accent' : ''}
                    ${isTVMode ? 'focus:ring-2 focus:ring-primary focus:outline-none' : ''}
                  `}
                >
                  {channel.logo ? (
                    <img
                      src={channel.logo}
                      alt={channel.name}
                      className="w-10 h-10 object-contain rounded bg-muted"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                      <Tv className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{channel.name}</p>
                    {channel.category && (
                      <p className="text-xs text-muted-foreground truncate">
                        {channel.category}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Channel Count */}
      <div className="p-3 border-t text-center text-sm text-muted-foreground">
        {filteredChannels.length} {filteredChannels.length === 1 ? 'canal' : 'canais'}
      </div>
    </div>
  );
}
