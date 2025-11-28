/**
 * ============================================================================
 * TV Channel Grid - Grid de Canais Otimizado para TV
 * ============================================================================
 * 
 * Componente de grid de canais com:
 * - Navegação por controle remoto
 * - Focus management
 * - Layout 10-foot
 * - Performance otimizada
 * - Animações suaves
 * 
 * @version 1.0.0
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Play, Star, Info } from 'lucide-react';
import type { M3UChannel, M3UCategory } from '../m3u/M3UParser';

// =============================================================================
// TYPES
// =============================================================================

interface TVChannelGridProps {
  categories: M3UCategory[];
  currentChannelId?: string;
  onChannelSelect: (channel: M3UChannel) => void;
  onBack?: () => void;
  className?: string;
}

interface FocusPosition {
  categoryIndex: number;
  channelIndex: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const VISIBLE_CHANNELS_PER_ROW = 5;
const CHANNEL_CARD_WIDTH = 200;
const CHANNEL_CARD_GAP = 16;

// =============================================================================
// COMPONENT
// =============================================================================

export function TVChannelGrid({
  categories,
  currentChannelId,
  onChannelSelect,
  onBack,
  className,
}: TVChannelGridProps) {
  const [focusPosition, setFocusPosition] = useState<FocusPosition>({
    categoryIndex: 0,
    channelIndex: 0,
  });
  const [scrollOffsets, setScrollOffsets] = useState<Record<number, number>>({});
  
  const containerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Get currently focused channel
  const getFocusedChannel = useCallback((): M3UChannel | null => {
    const category = categories[focusPosition.categoryIndex];
    if (!category) return null;
    return category.channels[focusPosition.channelIndex] || null;
  }, [categories, focusPosition]);

  // Handle navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const { categoryIndex, channelIndex } = focusPosition;
    const category = categories[categoryIndex];
    
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        if (categoryIndex > 0) {
          const prevCategory = categories[categoryIndex - 1];
          const newChannelIndex = Math.min(channelIndex, prevCategory.channels.length - 1);
          setFocusPosition({
            categoryIndex: categoryIndex - 1,
            channelIndex: newChannelIndex,
          });
        }
        break;

      case 'ArrowDown':
        e.preventDefault();
        if (categoryIndex < categories.length - 1) {
          const nextCategory = categories[categoryIndex + 1];
          const newChannelIndex = Math.min(channelIndex, nextCategory.channels.length - 1);
          setFocusPosition({
            categoryIndex: categoryIndex + 1,
            channelIndex: newChannelIndex,
          });
        }
        break;

      case 'ArrowLeft':
        e.preventDefault();
        if (channelIndex > 0) {
          setFocusPosition({
            ...focusPosition,
            channelIndex: channelIndex - 1,
          });
        }
        break;

      case 'ArrowRight':
        e.preventDefault();
        if (category && channelIndex < category.channels.length - 1) {
          setFocusPosition({
            ...focusPosition,
            channelIndex: channelIndex + 1,
          });
        }
        break;

      case 'Enter':
      case ' ':
        e.preventDefault();
        const focused = getFocusedChannel();
        if (focused) {
          onChannelSelect(focused);
        }
        break;

      case 'Backspace':
      case 'Escape':
        e.preventDefault();
        onBack?.();
        break;
    }
  }, [focusPosition, categories, getFocusedChannel, onChannelSelect, onBack]);

  // Bind keyboard events
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Scroll focused item into view
  useEffect(() => {
    const { categoryIndex, channelIndex } = focusPosition;
    
    // Horizontal scroll
    const offset = Math.max(0, channelIndex - 2) * (CHANNEL_CARD_WIDTH + CHANNEL_CARD_GAP);
    setScrollOffsets(prev => ({
      ...prev,
      [categoryIndex]: offset,
    }));

    // Vertical scroll
    const rowElement = rowRefs.current.get(categoryIndex);
    if (rowElement) {
      rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [focusPosition]);

  // Find initial focus position from current channel
  useEffect(() => {
    if (currentChannelId) {
      for (let catIdx = 0; catIdx < categories.length; catIdx++) {
        const chIdx = categories[catIdx].channels.findIndex(
          ch => ch.id === currentChannelId
        );
        if (chIdx !== -1) {
          setFocusPosition({
            categoryIndex: catIdx,
            channelIndex: chIdx,
          });
          break;
        }
      }
    }
  }, [currentChannelId, categories]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'w-full h-full bg-background overflow-hidden',
        'focus:outline-none',
        className
      )}
      tabIndex={0}
    >
      <div className="h-full overflow-y-auto py-8 px-4">
        {categories.map((category, catIdx) => (
          <div
            key={category.id}
            ref={(el) => {
              if (el) rowRefs.current.set(catIdx, el);
            }}
            className="mb-8"
          >
            {/* Category Header */}
            <div className="flex items-center gap-2 mb-4 px-4">
              {category.icon && (
                <span className="text-2xl">{category.icon}</span>
              )}
              <h2 className="text-xl font-semibold text-foreground">
                {category.displayName}
              </h2>
              <span className="text-sm text-muted-foreground ml-2">
                ({category.channelCount})
              </span>
            </div>

            {/* Channel Row */}
            <div className="relative overflow-hidden">
              <div
                className="flex gap-4 transition-transform duration-300 ease-out px-4"
                style={{
                  transform: `translateX(-${scrollOffsets[catIdx] || 0}px)`,
                }}
              >
                {category.channels.map((channel, chIdx) => {
                  const isFocused =
                    catIdx === focusPosition.categoryIndex &&
                    chIdx === focusPosition.channelIndex;
                  const isCurrent = channel.id === currentChannelId;

                  return (
                    <ChannelCard
                      key={channel.id}
                      channel={channel}
                      isFocused={isFocused}
                      isCurrent={isCurrent}
                      onSelect={() => onChannelSelect(channel)}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Focus indicator overlay */}
      <div className="absolute bottom-4 left-4 text-xs text-muted-foreground/50 pointer-events-none">
        <p>↑↓ Categorias • ←→ Canais • OK Assistir • BACK Voltar</p>
      </div>
    </div>
  );
}

// =============================================================================
// CHANNEL CARD COMPONENT
// =============================================================================

interface ChannelCardProps {
  channel: M3UChannel;
  isFocused: boolean;
  isCurrent: boolean;
  onSelect: () => void;
}

function ChannelCard({ channel, isFocused, isCurrent, onSelect }: ChannelCardProps) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'relative flex-shrink-0 w-[200px] rounded-xl overflow-hidden',
        'transition-all duration-200 ease-out',
        'bg-card border-2',
        'focus:outline-none',
        isFocused && 'scale-110 shadow-2xl z-10 border-primary',
        !isFocused && 'border-transparent hover:border-border',
        isCurrent && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
      )}
    >
      {/* Logo/Thumbnail */}
      <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden">
        {channel.logo ? (
          <img
            src={channel.logo}
            alt={channel.name}
            className="w-full h-full object-contain"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className="text-4xl font-bold text-muted-foreground/30">
            {channel.name.charAt(0).toUpperCase()}
          </div>
        )}

        {/* Play overlay on focus */}
        {isFocused && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center">
              <Play className="w-7 h-7 text-primary-foreground ml-1" />
            </div>
          </div>
        )}

        {/* Current playing indicator */}
        {isCurrent && !isFocused && (
          <div className="absolute top-2 right-2 px-2 py-0.5 bg-primary rounded text-xs text-primary-foreground font-medium">
            AO VIVO
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className={cn(
          'font-medium text-sm line-clamp-1',
          isFocused ? 'text-primary' : 'text-foreground'
        )}>
          {channel.name}
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
          {channel.group}
        </p>
      </div>

      {/* Focus ring glow effect */}
      {isFocused && (
        <div className="absolute inset-0 rounded-xl ring-4 ring-primary/30 pointer-events-none" />
      )}
    </button>
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export default TVChannelGrid;
