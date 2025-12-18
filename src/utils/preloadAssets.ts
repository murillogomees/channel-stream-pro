/**
 * Preload crítico de assets para melhorar LCP (Largest Contentful Paint)
 * Só carrega recursos essenciais da página inicial
 */

export function preloadCriticalAssets() {
  if (typeof window === 'undefined') return;

  // Already preloaded in index.html via <link rel="preload">
  // This function can be used for dynamic preloading if needed
  
  // Preconnect to external resources that will be needed
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const connections = supabaseUrl ? [supabaseUrl] : [];
  
  connections.forEach((url) => {
    // Check if preconnect already exists
    if (!document.querySelector(`link[href="${url}"][rel="preconnect"]`)) {
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = url;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    }
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
