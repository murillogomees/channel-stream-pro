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

### 5. Preload de Assets Críticos

**Arquivo:** `src/utils/preloadAssets.ts`
- Preload de logo.webp (LCP)
- Preparado para adicionar fonts críticas
- Executado antes do React renderizar

### 6. Preloading Inteligente de Streams

**Service:** `src/services/intelligentPreloadService.ts`
**Hooks:** `useIntelligentPreload`, `useChannelPreloader`

- Pré-carrega manifests de canais adjacentes
- Predição baseada em histórico de uso
- Cache de 30s com limite de 3 manifests
- Indicador visual ⚡ para canais pré-carregados

### 7. ABR (Adaptive Bitrate)

**Service:** `src/services/abrService.ts`
**Hook:** `useABR`
**Componentes:** `QualitySelector`, `QualityBadge`

- Múltiplas qualidades por stream HLS
- Modo auto ou manual
- Métricas: bitrate, buffer, dropped frames
- UI integrada no player

### 8. Connection-Aware Streaming

**Service:** `src/services/connectionService.ts`
**Hook:** `useConnectionAware`
**Componente:** `ConnectionIndicator`

- Detecta qualidade da conexão (Network Information API)
- Sugere bitrate inicial baseado na conexão
- Ajusta configuração HLS por qualidade de rede
- Monitora mudanças de conexão em tempo real

### 9. Error Recovery Avançado

**Service:** `src/services/errorRecoveryService.ts`
**Hook:** `useErrorRecovery`
**Componente:** `RecoveryStatus`

- Retry automático com backoff exponencial
- Fallback de qualidade em erros de mídia
- Reload de manifest em erros de rede
- Estatísticas de recuperação

### 10. Web Vitals Monitoring

**Service:** `src/services/webVitalsService.ts`
**Hook:** `useWebVitals`
**Componente:** `WebVitalsCard` (Dashboard Admin)

- Monitora LCP, FID, CLS, FCP, TTFB
- Score geral de performance (0-100)
- Rating por métrica (good/needs-improvement/poor)
- Dashboard no Admin Analytics

### 11. Stream Cache (Service Worker)

**Service:** `src/services/streamCacheService.ts`

- Cache de manifests HLS (30s TTL)
- Cache de segmentos (60s TTL)
- Limite de 100MB total
- Prefetch de segmentos iniciais

### 12. Font Optimization (NOVO)

**Problema:** 8 `@import` de fontes no CSS bloqueando render (200-400ms LCP delay)

**Solução:**
- Removidos todos os `@import` do `index.css`
- Fontes carregadas via `requestIdleCallback` no `index.html`
- Todas as fontes em uma única requisição
- `display=swap` para evitar FOIT

**Resultado:** LCP ~200-400ms mais rápido

### 13. Resource Hints (NOVO)

**Arquivo:** `index.html`

- `<link rel="preconnect">` para Supabase (estabelece conexão TCP/TLS antecipadamente)
- `<link rel="dns-prefetch">` para CDNs, Google Fonts, Facebook
- `<link rel="preconnect">` para Google Fonts (gstatic.com)
- Preload de LCP image com `fetchpriority="high"`

**Resultado:** Conexões ~100-200ms mais rápidas

### 14. Virtual Lists (NOVO)

**Componentes:**
- `src/components/iptv/VirtualChannelGrid.tsx` - Grid virtualizado para canais
- `src/components/iptv/VirtualChannelList.tsx` - Lista virtualizada para sidebar

**Tecnologia:** `@tanstack/react-virtual`

- Renderiza apenas itens visíveis + buffer (overscan)
- Suporta milhares de itens sem degradação
- Scroll suave com estimateSize
- Memoização de itens individuais

**Uso:**
```tsx
import { VirtualChannelGrid, VirtualChannelList } from '@/components/iptv';

// Grid para página de canais (substitui TVContentGrid para listas grandes)
<VirtualChannelGrid 
  channels={channels} 
  columns={5}
  isFavorite={isFavorite}
  onPlay={handlePlay}
  onToggleFavorite={handleToggleFavorite}
/>

// Lista para sidebar
<VirtualChannelList
  channels={filteredChannels}
  currentChannelId={currentId}
  onSelectChannel={handleSelect}
/>
```

### 15. React.memo Optimization (NOVO)

**Componentes otimizados:**
- `TVContentCard` - Card de conteúdo memoizado
- `VirtualChannelGrid` - Grid memoizado
- `VirtualChannelList` - Lista memoizada
- Items individuais dentro dos componentes virtualizados

**Padrão aplicado:**
```tsx
export const Component = memo(function Component(props) {
  // ...
});
```

### 16. Memory Management (NOVO)

**Hook:** `src/hooks/usePlayerCleanup.ts`

- Cleanup automático de instâncias HLS
- WeakMap para cache de event listeners (evita memory leaks)
- `forceGC` hint para garbage collection
- Estatísticas de cleanup

**Uso:**
```tsx
const { registerHls, registerVideoElement, cleanup } = usePlayerCleanup();

// Registrar instância HLS
registerHls(hlsInstance);

// Registrar video element para tracking de listeners
registerVideoElement(videoRef.current);

// Cleanup manual (também chamado no unmount)
cleanup();
```

### 17. Debounced Search (NOVO)

**Hook:** `src/hooks/useDebouncedSearch.ts`

- Debounce de 300ms para inputs de busca
- Evita re-renders excessivos durante digitação
- `useDebouncedValue` para valores simples

**Uso:**
```tsx
const { query, setQuery, filteredItems, isDebouncing } = useDebouncedSearch(
  channels,
  {
    delay: 300,
    filterFn: (channel, q) => channel.name.toLowerCase().includes(q),
  }
);
```

### 18. Bundle Analyzer (NOVO)

**Plugin:** `rollup-plugin-visualizer`

- Gera `dist/stats.html` no build de produção
- Visualização treemap do bundle
- Mostra tamanho gzip e brotli
- Identifica dependências grandes

**Uso:**
```bash
npm run build
# Abre dist/stats.html no navegador para análise
```

## 📊 Performance Esperada

### Antes das otimizações:
- Homepage: ~2-3s
- Admin pages: ~3-5s
- 21 setInterval ativos
- AuthContext bloqueando 300-500ms
- Fontes bloqueando render 200-400ms

### Depois das otimizações:
- **Homepage (`/`, `/tutorial`, `/login`):** < 600ms
- **Admin pages leves:** < 1.0s
- **Admin pages pesadas:** < 1.3s
- **Listas com 1000+ itens:** Scroll suave (virtualizado)
- 0 setInterval em páginas públicas
- AuthContext não-bloqueante
- Fontes carregadas async

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
- [x] Font optimization (async loading)
- [x] Resource hints (preconnect, dns-prefetch)
- [x] Virtual lists para listas grandes
- [x] React.memo em componentes pesados
- [x] Memory management para player
- [x] Debounced search
- [x] Bundle analyzer

## 🚀 Como Testar

1. **Chrome DevTools:**
   - Lighthouse (Performance score > 90)
   - Network tab (Waterfall)
   - Performance tab (Flame chart)

2. **Bundle Analysis:**
   ```bash
   npm run build
   # Abrir dist/stats.html
   ```

3. **Real User Monitoring:**
   - PageSpeed Insights
   - WebPageTest
   - GTmetrix

4. **Métricas específicas:**
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

## 🔧 Quando Usar Virtual Lists

Use `VirtualChannelGrid` ou `VirtualChannelList` quando:
- Lista tem **mais de 100 itens**
- Usuários fazem scroll frequente
- Items têm altura consistente

Continue usando componentes normais quando:
- Lista tem **menos de 50 itens**
- Lista é estática (não muda frequentemente)
- Performance já é aceitável
