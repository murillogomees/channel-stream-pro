/**
 * OptimizedImage - Image component optimized for Web Vitals
 * - Reserves space to prevent CLS
 * - Priority loading for LCP
 * - Fallback placeholder
 */

import { useState, memo, ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface OptimizedImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  /** Image source URL */
  src?: string;
  /** Alt text for accessibility */
  alt: string;
  /** Aspect ratio (e.g., "16/9", "2/3", "1/1") */
  aspectRatio?: string;
  /** Priority loading (for LCP images) */
  priority?: boolean;
  /** Fallback content when image fails */
  fallback?: React.ReactNode;
  /** Container className */
  containerClassName?: string;
}

export const OptimizedImage = memo(function OptimizedImage({
  src,
  alt,
  aspectRatio = '16/9',
  priority = false,
  fallback,
  containerClassName,
  className,
  ...props
}: OptimizedImageProps) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  // Convert aspectRatio string to CSS value
  const aspectValue = aspectRatio.includes('/') ? aspectRatio : `${aspectRatio}/1`;

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-muted',
        containerClassName
      )}
      style={{ aspectRatio: aspectValue }}
    >
      {/* Skeleton placeholder - always rendered to reserve space */}
      {status === 'loading' && (
        <div className="absolute inset-0 bg-gradient-to-r from-muted via-muted-foreground/5 to-muted animate-pulse" />
      )}

      {/* Image */}
      {src && status !== 'error' && (
        <img
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding={priority ? 'sync' : 'async'}
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
          className={cn(
            'absolute inset-0 w-full h-full object-cover transition-opacity duration-300',
            status === 'loaded' ? 'opacity-100' : 'opacity-0',
            className
          )}
          {...props}
        />
      )}

      {/* Error fallback */}
      {(status === 'error' || !src) && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          {fallback || (
            <span className="text-xs text-muted-foreground text-center p-2 line-clamp-2">
              {alt}
            </span>
          )}
        </div>
      )}
    </div>
  );
});

export default OptimizedImage;
