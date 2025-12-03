/**
 * PlayerSkeleton - Optimistic UI for instant channel switching
 * 
 * Shows immediately when switching channels while video loads in background
 */

import { memo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Radio, Tv } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlayerSkeletonProps {
  title?: string;
  logo?: string;
  category?: string;
  isLive?: boolean;
  className?: string;
}

export const PlayerSkeleton = memo(function PlayerSkeleton({
  title,
  logo,
  category,
  isLive = true,
  className,
}: PlayerSkeletonProps) {
  return (
    <div className={cn(
      "relative w-full aspect-video bg-black flex items-center justify-center",
      className
    )}>
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />
      
      {/* Channel info overlay */}
      <div className="absolute top-4 left-4 flex items-center gap-3 z-10">
        {logo ? (
          <img 
            src={logo} 
            alt="" 
            className="w-10 h-10 rounded-lg object-contain bg-white/10"
            onError={(e) => e.currentTarget.style.display = 'none'}
          />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
            <Tv className="w-5 h-5 text-white/60" />
          </div>
        )}
        <div>
          {title ? (
            <h2 className="text-white font-medium text-lg">{title}</h2>
          ) : (
            <Skeleton className="h-5 w-32 bg-white/20" />
          )}
          {category ? (
            <p className="text-white/60 text-sm">{category}</p>
          ) : (
            <Skeleton className="h-3 w-20 bg-white/10 mt-1" />
          )}
        </div>
      </div>

      {/* Live badge */}
      {isLive && (
        <div className="absolute top-4 right-4 z-10">
          <div className="flex items-center gap-1 bg-red-500/90 px-2 py-1 rounded text-xs text-white font-medium">
            <Radio className="w-3 h-3" />
            AO VIVO
          </div>
        </div>
      )}

      {/* Center loading indicator */}
      <div className="relative z-10 flex flex-col items-center gap-4">
        <div className="relative">
          {/* Outer ring */}
          <div className="w-20 h-20 rounded-full border-4 border-primary/20 animate-pulse" />
          
          {/* Spinning loader */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          </div>
        </div>
        
        <div className="text-center">
          <p className="text-white/90 font-medium">Carregando...</p>
          <p className="text-white/50 text-sm mt-1">
            {title ? `Conectando a ${title}` : 'Preparando stream'}
          </p>
        </div>
      </div>

      {/* Bottom progress simulation */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
        <div className="h-full bg-primary/60 animate-pulse" style={{ width: '30%' }} />
      </div>
    </div>
  );
});

export default PlayerSkeleton;
