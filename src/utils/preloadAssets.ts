/**
 * Preload crítico de assets para melhorar LCP (Largest Contentful Paint)
 * Só carrega recursos essenciais da página inicial
 */

const criticalAssets = [
  '/logo.webp',
  // Hero background é carregado via CSS, não precisa preload
];

export function preloadCriticalAssets() {
  if (typeof window === 'undefined') return;

  criticalAssets.forEach((asset) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = asset.endsWith('.webp') || asset.endsWith('.jpg') ? 'image' : 'fetch';
    link.href = asset;
    document.head.appendChild(link);
  });
}

/**
 * Preload de fonts para evitar FOUT (Flash of Unstyled Text)
 */
export function preloadFonts() {
  const fonts = [
    // Adicione aqui as fontes críticas se usar Google Fonts ou custom fonts
  ];

  fonts.forEach((font) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'font';
    link.type = 'font/woff2';
    link.crossOrigin = 'anonymous';
    link.href = font;
    document.head.appendChild(link);
  });
}
