/**
 * TV-Optimized Focusable Button
 * Larger hit areas, visible focus states for D-pad navigation
 */

import React, { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface TvFocusableButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  focusId: string;
  isFocused?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'ghost' | 'primary';
  tvScale?: number;
}

export const TvFocusableButton = forwardRef<HTMLButtonElement, TvFocusableButtonProps>(
  function TvFocusableButton(
    { 
      children, 
      focusId, 
      isFocused, 
      size = 'md', 
      variant = 'default',
      tvScale = 1,
      className,
      ...props 
    },
    ref
  ) {
    const sizeClasses = {
      sm: 'p-2 min-w-[40px] min-h-[40px]',
      md: 'p-3 min-w-[48px] min-h-[48px]',
      lg: 'p-4 min-w-[56px] min-h-[56px]',
      xl: 'p-5 min-w-[64px] min-h-[64px]',
    };

    const variantClasses = {
      default: 'bg-white/10 hover:bg-white/20',
      ghost: 'bg-transparent hover:bg-white/10',
      primary: 'bg-primary hover:bg-primary/90',
    };

    // Scale up for TV
    const scaledSize = tvScale > 1 ? 'lg' : size;

    return (
      <button
        ref={ref}
        data-focus-id={focusId}
        className={cn(
          'rounded-full transition-all duration-200',
          'flex items-center justify-center',
          sizeClasses[scaledSize],
          variantClasses[variant],
          // Focus ring for TV navigation
          'focus:outline-none focus-visible:ring-4 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-black',
          // Extra prominent focus for TV
          isFocused && [
            'ring-4 ring-primary ring-offset-2 ring-offset-black',
            'scale-110 bg-primary/30',
            'shadow-[0_0_20px_rgba(var(--primary),0.5)]',
          ],
          className
        )}
        style={{
          // TV-specific scaling
          transform: isFocused ? `scale(${1.1 * tvScale})` : `scale(${tvScale})`,
        }}
        {...props}
      >
        {children}
      </button>
    );
  }
);

export default TvFocusableButton;
