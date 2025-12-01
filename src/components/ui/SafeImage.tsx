/**
 * SafeImage Component
 * Exibe imagens com fallback automático para placeholder quando falham (404, etc)
 */

import { useState, useEffect } from 'react';
import placeholderImage from '@/assets/placeholder-content.jpg';

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  fallbackSrc?: string;
}

export function SafeImage({ 
  src, 
  alt, 
  fallbackSrc = placeholderImage,
  onError,
  ...props 
}: SafeImageProps) {
  const [imgSrc, setImgSrc] = useState<string>(src);
  const [hasError, setHasError] = useState(false);

  // Reset quando src mudar
  useEffect(() => {
    setImgSrc(src);
    setHasError(false);
  }, [src]);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (!hasError) {
      console.warn('[SafeImage] Falha ao carregar imagem:', src);
      setHasError(true);
      setImgSrc(fallbackSrc);
    }
    
    // Chamar onError customizado se fornecido
    if (onError) {
      onError(e);
    }
  };

  // Validar URL antes de renderizar
  const isValidUrl = (url: string) => {
    try {
      const parsed = new URL(url, window.location.origin);
      // Rejeitar URLs que definitivamente vão falhar
      if (url.includes('None') || url.includes('undefined') || url.includes('null')) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  };

  // Se URL é inválida, usar fallback imediatamente
  const finalSrc = isValidUrl(imgSrc) ? imgSrc : fallbackSrc;

  return (
    <img 
      {...props}
      src={finalSrc}
      alt={alt}
      onError={handleError}
      loading="lazy"
    />
  );
}