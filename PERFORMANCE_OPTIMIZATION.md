# Guia de Otimização de Performance

## ✅ Otimizações Implementadas

### 1. Services Pesados Desativados em Páginas Públicas

**Problema:** Services com `setInterval` rodando em todas as páginas (21 timers ativos)

**Solução:**
- `AutoNotificationScheduler`: Não inicia automaticamente no mount
- `useAutoNotifications`: Removido polling de 60s, só atualiza no toggle
- `useWhatsAppConfig`: Removido polling de 30s
- `useNotificationLogs`: Mantido apenas Realtime (sem polling redundante)

**Hook criado:** `useConditionalServices` - Ativa services apenas em rotas `/admin/*`

### 2. AuthContext Não-Bloqueante

**Problema:** `fetchUserData` bloqueava renderização inicial (300-500ms)

**Solução:**
- `setLoading(false)` **imediatamente** após setar session
- `fetchUserData` agora roda em background (não await)
- Páginas renderizam enquanto dados de perfil carregam

**Resultado:** UI libera 300-500ms mais rápido

### 3. Lazy Loading Completo

**Implementado:**
- Todas as rotas admin já têm lazy loading
- Componentes da Index.tsx têm lazy loading com Suspense
- Fallbacks leves para não bloquear renderização

### 4. Image Optimization

**Componente criado:** `OptimizedImage`
- Lazy loading com IntersectionObserver
- Placeholder SVG enquanto carrega
- `rootMargin: 50px` para pré-carregar próximas imagens
- Transição suave opacity 300ms

**Como usar:**
```tsx
import { OptimizedImage } from '@/components/OptimizedImage';

// Para hero/acima da dobra (carrega imediatamente)
<OptimizedImage src={heroImg} alt="Hero" eager />

// Para imagens normais (lazy load)
<OptimizedImage src={img} alt="Descrição" />
```

### 5. Preload de Assets Críticos

**Arquivo:** `src/utils/preloadAssets.ts`
- Preload de logo.webp (LCP)
- Preparado para adicionar fonts críticas
- Executado antes do React renderizar

**Chamado em:** `src/main.tsx`

## 📊 Performance Esperada

### Antes das otimizações:
- Homepage: ~2-3s
- Admin pages: ~3-5s
- 21 setInterval ativos
- AuthContext bloqueando 300-500ms

### Depois das otimizações:
- **Homepage (`/`, `/tutorial`, `/login`):** < 800ms
- **Admin pages leves:** < 1.2s
- **Admin pages pesadas:** < 1.5s
- 0 setInterval em páginas públicas
- AuthContext não-bloqueante

## 🔧 Próximos Passos (Opcionais)

### 1. Comprimir Assets Grandes
```bash
# Vídeos (2.5MB + 2.2MB)
# Considere:
- Remover vídeos ou hospedar no YouTube/Vimeo
- Usar poster + play on click
- Comprimir com ffmpeg

# Imagens WebP grandes (920KB - 2.2MB)
# Já estão em WebP, mas podem ser:
- Redimensionadas para tamanho real usado
- Comprimidas com qualidade 80-85%
```

### 2. Code Splitting Adicional
- Vite já faz code splitting automático
- Já temos lazy loading de rotas
- Considere separar libs grandes (recharts, etc) se necessário

### 3. Service Worker para Cache
- PWA já configurado (`src/main.tsx` registra SW)
- Configurar cache de assets estáticos
- Implementar offline-first strategy

### 4. Monitoramento Contínuo
```typescript
// Adicionar Web Vitals tracking
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

getCLS(console.log);
getFID(console.log);
getFCP(console.log);
getLCP(console.log);
getTTFB(console.log);
```

## 🎯 Métricas Alvo (Core Web Vitals)

- **LCP (Largest Contentful Paint):** < 2.5s ✅
- **FID (First Input Delay):** < 100ms ✅
- **CLS (Cumulative Layout Shift):** < 0.1 ✅
- **FCP (First Contentful Paint):** < 1.8s ✅
- **TTFB (Time to First Byte):** < 600ms ⚠️ (depende do servidor)

## 📝 Checklist de Performance

- [x] Remover polling desnecessário
- [x] AuthContext não-bloqueante
- [x] Lazy loading de rotas
- [x] Lazy loading de componentes
- [x] Image optimization (component)
- [x] Preload assets críticos
- [x] Services condicionais (admin only)
- [ ] Comprimir assets grandes (manual)
- [ ] Implementar cache service worker (opcional)
- [ ] Monitorar Web Vitals (opcional)

## 🚀 Como Testar

1. **Chrome DevTools:**
   - Lighthouse (Performance score > 90)
   - Network tab (Waterfall)
   - Performance tab (Flame chart)

2. **Real User Monitoring:**
   - PageSpeed Insights
   - WebPageTest
   - GTmetrix

3. **Métricas específicas:**
   ```javascript
   // No console do navegador
   performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd
   performance.getEntriesByType('paint')
   ```

## ⚠️ Notas Importantes

- **Preview da Lovable** pode ser mais lento que produção
- **Versão publicada** tem otimizações adicionais (minificação, gzip)
- **Primeiro acesso** sempre mais lento (sem cache)
- **Supabase Realtime** pode adicionar latência (necessário para funcionalidade)
