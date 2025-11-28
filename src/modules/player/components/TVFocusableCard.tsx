/**
 * ============================================================================
 * TVFocusableCard - Card com Suporte a Foco para TVs
 * ============================================================================
 * 
 * Card otimizado para navegação por controle remoto.
 * Usa o FocusManager para navegação.
 * 
 * @version 1.0.0
 */

import { forwardRef, useCallback } from 'react';
import { useFocusable } from '../hooks/useFocusManager';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface TVFocusableCardProps {
  /** ID único do card */
  id: string;
  /** ID do grupo de foco */
  groupId: string;
  /** Posição na linha (navegação vertical) */
  row: number;
  /** Posição na coluna (navegação horizontal) */
  col: number;
  /** Título do card */
  title: string;
  /** Subtítulo opcional */
  subtitle?: string;
  /** URL da imagem */
  image?: string;
  /** Callback ao selecionar */
  onSelect?: () => void;
  /** Callback ao receber foco */
  onFocus?: () => void;
  /** Tamanho do card */
  size?: 'sm' | 'md' | 'lg';
  /** Classes CSS adicionais */
  className?: string;
  /** Desabilitar foco */
  disabled?: boolean;
}

// =============================================================================
// SIZE CONFIGS
// =============================================================================

const sizeConfigs = {
  sm: {
    card: 'w-[140px] h-[100px]',
    image: 'h-[70px]',
    title: 'text-xs',
    subtitle: 'text-[10px]',
  },
  md: {
    card: 'w-[180px] h-[140px]',
    image: 'h-[100px]',
    title: 'text-sm',
    subtitle: 'text-xs',
  },
  lg: {
    card: 'w-[240px] h-[180px]',
    image: 'h-[130px]',
    title: 'text-base',
    subtitle: 'text-sm',
  },
};

// =============================================================================
// COMPONENT
// =============================================================================

export const TVFocusableCard = forwardRef<HTMLDivElement, TVFocusableCardProps>(
  (
    {
      id,
      groupId,
      row,
      col,
      title,
      subtitle,
      image,
      onSelect,
      onFocus,
      size = 'md',
      className,
      disabled,
    },
    forwardedRef
  ) => {
    const { ref, isFocused, focusProps } = useFocusable({
      groupId,
      id,
      row,
      col,
      onFocus,
      onSelect,
      disabled,
    });

    const config = sizeConfigs[size];

    const handleClick = useCallback(() => {
      onSelect?.();
    }, [onSelect]);

    return (
      <div
        ref={(node) => {
          // Assign to both refs
          (ref as React.MutableRefObject<HTMLElement | null>).current = node;
          if (typeof forwardedRef === 'function') {
            forwardedRef(node);
          } else if (forwardedRef) {
            forwardedRef.current = node;
          }
        }}
        onClick={handleClick}
        className={cn(
          // Base
          'relative flex-shrink-0 rounded-lg overflow-hidden cursor-pointer',
          'transition-all duration-200 ease-out',
          'bg-card border border-border',
          
          // Size
          config.card,
          
          // Focus state - TV style
          isFocused && [
            'ring-4 ring-primary ring-offset-2 ring-offset-background',
            'scale-105 z-10',
            'shadow-lg shadow-primary/20',
          ],
          
          // Hover (mouse)
          'hover:scale-[1.02] hover:border-primary/50',
          
          // Disabled
          disabled && 'opacity-50 pointer-events-none',
          
          className
        )}
        {...focusProps}
      >
        {/* Image */}
        <div
          className={cn(
            'w-full bg-muted flex items-center justify-center overflow-hidden',
            config.image
          )}
        >
          {image ? (
            <img
              src={image}
              alt={title}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="text-muted-foreground text-2xl">📺</div>
          )}
        </div>

        {/* Text */}
        <div className="p-2">
          <h3
            className={cn(
              'font-medium truncate text-foreground',
              config.title
            )}
          >
            {title}
          </h3>
          {subtitle && (
            <p
              className={cn(
                'text-muted-foreground truncate',
                config.subtitle
              )}
            >
              {subtitle}
            </p>
          )}
        </div>

        {/* Focus indicator */}
        {isFocused && (
          <div className="absolute inset-0 border-2 border-primary rounded-lg pointer-events-none" />
        )}
      </div>
    );
  }
);

TVFocusableCard.displayName = 'TVFocusableCard';

export default TVFocusableCard;
