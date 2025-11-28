/**
 * ============================================================================
 * TVGridLayout - Grid Otimizado para TVs
 * ============================================================================
 * 
 * Layout grid responsivo com:
 * - Safe zones para TVs
 * - Navegação por controle remoto
 * - Foco visual destacado
 * - Scroll automático
 * 
 * @version 1.0.0
 */

import { useRef, useEffect, useCallback } from 'react';
import { useFocusGroup, useFocusable } from '../hooks/useFocusManager';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface TVGridLayoutProps<T> {
  /** Itens para renderizar */
  items: T[];
  /** ID único do grupo */
  groupId: string;
  /** Função para extrair ID do item */
  keyExtractor: (item: T) => string;
  /** Renderiza cada item */
  renderItem: (item: T, index: number, isFocused: boolean) => React.ReactNode;
  /** Colunas por linha */
  columns?: number;
  /** Gap entre itens (Tailwind class) */
  gap?: string;
  /** Auto ativar foco ao montar */
  autoFocus?: boolean;
  /** Callback ao selecionar item */
  onSelect?: (item: T, index: number) => void;
  /** Callback ao focar item */
  onFocus?: (item: T, index: number) => void;
  /** ID do item com foco inicial */
  defaultFocusId?: string;
  /** Classe CSS do container */
  className?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Componente de loading */
  loadingComponent?: React.ReactNode;
  /** Componente vazio */
  emptyComponent?: React.ReactNode;
  /** Tem mais itens para carregar */
  hasMore?: boolean;
  /** Callback para carregar mais */
  onLoadMore?: () => void;
}

// =============================================================================
// GRID ITEM WRAPPER
// =============================================================================

interface GridItemWrapperProps {
  groupId: string;
  itemId: string;
  row: number;
  col: number;
  onSelect?: () => void;
  onFocus?: () => void;
  children: (isFocused: boolean) => React.ReactNode;
}

function GridItemWrapper({
  groupId,
  itemId,
  row,
  col,
  onSelect,
  onFocus,
  children,
}: GridItemWrapperProps) {
  const { ref, isFocused, focusProps } = useFocusable({
    groupId,
    id: itemId,
    row,
    col,
    onSelect,
    onFocus,
  });

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      {...focusProps}
      className="outline-none"
    >
      {children(isFocused)}
    </div>
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

export function TVGridLayout<T>({
  items,
  groupId,
  keyExtractor,
  renderItem,
  columns = 6,
  gap = 'gap-4',
  autoFocus = false,
  onSelect,
  onFocus,
  defaultFocusId,
  className,
  isLoading,
  loadingComponent,
  emptyComponent,
  hasMore,
  onLoadMore,
}: TVGridLayoutProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);

  // Setup focus group
  useFocusGroup({
    groupId,
    defaultFocusId: defaultFocusId || (items.length > 0 ? keyExtractor(items[0]) : undefined),
    autoActivate: autoFocus,
  });

  // Infinite scroll
  useEffect(() => {
    if (!hasMore || !onLoadMore) return;

    const trigger = loadMoreTriggerRef.current;
    if (!trigger) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    observerRef.current.observe(trigger);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [hasMore, onLoadMore]);

  // Calculate row/col for each item
  const getPosition = useCallback((index: number) => {
    return {
      row: Math.floor(index / columns),
      col: index % columns,
    };
  }, [columns]);

  // Loading state
  if (isLoading && items.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        {loadingComponent || (
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
        )}
      </div>
    );
  }

  // Empty state
  if (!isLoading && items.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        {emptyComponent || (
          <p className="text-muted-foreground text-lg">Nenhum item encontrado</p>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'tv-safe-zone overflow-y-auto scrollbar-hide',
        className
      )}
    >
      <div
        className={cn(
          'grid',
          gap,
          // Responsive columns
          `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-${columns}`
        )}
        style={{
          // For TV, use fixed columns
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        }}
      >
        {items.map((item, index) => {
          const id = keyExtractor(item);
          const { row, col } = getPosition(index);

          return (
            <GridItemWrapper
              key={id}
              groupId={groupId}
              itemId={id}
              row={row}
              col={col}
              onSelect={() => onSelect?.(item, index)}
              onFocus={() => onFocus?.(item, index)}
            >
              {(isFocused) => renderItem(item, index, isFocused)}
            </GridItemWrapper>
          );
        })}
      </div>

      {/* Load more trigger */}
      {hasMore && (
        <div
          ref={loadMoreTriggerRef}
          className="flex items-center justify-center py-8"
        >
          {isLoading && (
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// PRESETS
// =============================================================================

/** Grid para canais de TV (6 colunas) */
export function TVChannelGrid<T>(props: Omit<TVGridLayoutProps<T>, 'columns'>) {
  return <TVGridLayout {...props} columns={6} />;
}

/** Grid para filmes/séries (5 colunas, cards maiores) */
export function TVMovieGrid<T>(props: Omit<TVGridLayoutProps<T>, 'columns'>) {
  return <TVGridLayout {...props} columns={5} />;
}

/** Grid compacto (8 colunas) */
export function TVCompactGrid<T>(props: Omit<TVGridLayoutProps<T>, 'columns'>) {
  return <TVGridLayout {...props} columns={8} />;
}

export default TVGridLayout;
