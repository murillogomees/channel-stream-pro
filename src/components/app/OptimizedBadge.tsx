import { Badge } from '@/components/ui/badge';
import { Zap, Cloud } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OptimizedBadgeProps {
  isOptimized?: boolean;
  variant?: 'badge' | 'icon' | 'full';
  className?: string;
}

/**
 * Badge para indicar que o conteúdo está hospedado no CDN (R2)
 * Mostra visualmente ao usuário que o stream terá melhor performance
 */
export function OptimizedBadge({ 
  isOptimized, 
  variant = 'badge',
  className 
}: OptimizedBadgeProps) {
  if (!isOptimized) return null;

  if (variant === 'icon') {
    return (
      <div 
        className={cn(
          "p-1 rounded-full bg-emerald-500/20 text-emerald-400",
          className
        )}
        title="Conteúdo otimizado - CDN"
      >
        <Zap className="w-3 h-3" />
      </div>
    );
  }

  if (variant === 'full') {
    return (
      <Badge 
        variant="outline" 
        className={cn(
          "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 gap-1",
          className
        )}
      >
        <Cloud className="w-3 h-3" />
        CDN Otimizado
      </Badge>
    );
  }

  return (
    <Badge 
      variant="secondary" 
      className={cn(
        "bg-emerald-500/20 text-emerald-400 text-[10px] px-1.5 py-0 gap-0.5",
        className
      )}
    >
      <Zap className="w-2.5 h-2.5" />
      CDN
    </Badge>
  );
}

export default OptimizedBadge;
