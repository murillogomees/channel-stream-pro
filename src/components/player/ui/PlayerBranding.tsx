/**
 * PlayerBranding - Sistema de branding configurável white-label
 * 
 * @features
 * - Logo customizável
 * - Nome da marca
 * - Cores primárias/secundárias via CSS variables
 */

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { Tv } from 'lucide-react';

export interface BrandingConfig {
  /** Brand name */
  name?: string;
  /** Logo URL */
  logoUrl?: string;
  /** Show "LIVE" badge */
  isLive?: boolean;
  /** Channel category */
  category?: string;
}

interface PlayerBrandingProps {
  config: BrandingConfig;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const PlayerBranding = memo(function PlayerBranding({
  config,
  className,
  size = 'md',
}: PlayerBrandingProps) {
  const { name, logoUrl, isLive, category } = config;

  const sizeClasses = {
    sm: 'gap-2',
    md: 'gap-3',
    lg: 'gap-4',
  };

  const logoSizes = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
  };

  return (
    <div className={cn('flex items-center', sizeClasses[size], className)}>
      {/* Logo */}
      <div className={cn(
        'flex items-center justify-center rounded-lg bg-black/40 backdrop-blur-sm overflow-hidden',
        logoSizes[size]
      )}>
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={name || 'Channel'}
            className="w-full h-full object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <Tv className="w-1/2 h-1/2 text-white/70" />
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col">
        {/* Live Badge + Category */}
        <div className="flex items-center gap-2">
          {isLive && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-destructive text-destructive-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-current mr-1 animate-pulse" />
              Ao Vivo
            </span>
          )}
          {category && (
            <span className="text-xs text-white/60 font-medium">
              {category}
            </span>
          )}
        </div>

        {/* Channel Name */}
        {name && (
          <h2 className={cn(
            'font-semibold text-white truncate max-w-[200px] sm:max-w-[300px]',
            textSizes[size]
          )}>
            {name}
          </h2>
        )}
      </div>
    </div>
  );
});

export default PlayerBranding;
