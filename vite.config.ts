import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'logo.png', 'logo.webp'],
      manifest: {
        name: 'IPTV Player',
        short_name: 'IPTV',
        description: 'Assista TV online com qualidade HD',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'any',
        icons: [
          {
            src: 'logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        categories: ['entertainment', 'video'],
        screenshots: []
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,webp,svg,jpg,jpeg}'],
        maximumFileSizeToCacheInBytes: 5000000, // 5MB
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              }
            }
          },
          {
            urlPattern: /\.m3u8$/,
            handler: 'NetworkOnly' // Never cache video streams
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          },
          {
            urlPattern: /\.(?:js|css)$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'static-resources',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          }
        ]
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Separar bibliotecas principais em chunks dedicados
          if (id.includes('node_modules')) {
            // React ecosystem
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'react-vendor';
            }
            // Radix UI components
            if (id.includes('@radix-ui')) {
              return 'ui-vendor';
            }
            // Supabase
            if (id.includes('@supabase')) {
              return 'supabase';
            }
            // Recharts - Carregado apenas quando necessário (páginas admin)
            if (id.includes('recharts')) {
              return 'charts';
            }
            // HLS.js para vídeo
            if (id.includes('hls.js')) {
              return 'video';
            }
            // Formulários
            if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('zod')) {
              return 'forms';
            }
            // Datas
            if (id.includes('date-fns')) {
              return 'date';
            }
            // Animações
            if (id.includes('framer-motion')) {
              return 'animation';
            }
            // Outras bibliotecas node_modules vão para vendor comum
            return 'vendor';
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    // Otimizar tamanho de assets
    assetsInlineLimit: 4096, // Inline assets < 4kb como base64
    cssCodeSplit: true, // Separar CSS por chunk
    minify: 'terser', // Minificação agressiva em produção
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs em produção
        drop_debugger: true,
        pure_funcs: ['console.log'], // Remove chamadas específicas
      },
      mangle: {
        safari10: true, // Compatibilidade com Safari 10+
      },
    },
    // Otimizações adicionais para reduzir JavaScript não usado
    reportCompressedSize: false, // Não reportar tamanho comprimido (mais rápido)
    sourcemap: false, // Sem sourcemaps em produção (menor)
  },
}));
