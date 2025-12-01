/**
 * Utilitários para tratamento de imagens
 * Corrige URLs inválidas do TMDB e outras fontes externas
 */

import placeholderImage from '@/assets/placeholder-content.jpg';

/**
 * Valida e corrige URLs de imagens
 * Retorna a URL corrigida ou o placeholder se inválida
 */
export function getSafeImageUrl(url: string | null | undefined): string {
  if (!url) return placeholderImage;
  
  // Verificar se URL contém valores inválidos
  const invalidPatterns = [
    'None',
    'undefined',
    'null',
    '/w780None',
    '/original/None',
  ];
  
  if (invalidPatterns.some(pattern => url.includes(pattern))) {
    return placeholderImage;
  }
  
  // Se URL começa com http/https, retornar como está
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // Se é caminho relativo, retornar como está
  if (url.startsWith('/')) {
    return url;
  }
  
  // Caso contrário, retornar placeholder
  return placeholderImage;
}

/**
 * Retorna props otimizadas para <img> com fallback automático
 */
export function getSafeImageProps(
  url: string | null | undefined, 
  alt: string
): {
  src: string;
  alt: string;
  onError: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  loading: 'lazy';
} {
  return {
    src: getSafeImageUrl(url),
    alt,
    onError: (e) => {
      const target = e.currentTarget;
      if (target.src !== placeholderImage) {
        target.src = placeholderImage;
      }
    },
    loading: 'lazy' as const,
  };
}