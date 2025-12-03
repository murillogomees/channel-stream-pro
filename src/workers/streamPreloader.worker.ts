/**
 * Stream Preloader Web Worker
 * Executa preload de manifestos e segmentos em thread separada
 * para não bloquear a UI principal
 */

interface PreloadTask {
  id: string;
  url: string;
  priority: 'high' | 'medium' | 'low';
  type: 'manifest' | 'segment';
}

interface PreloadResult {
  id: string;
  url: string;
  success: boolean;
  data?: string;
  size?: number;
  duration?: number;
  error?: string;
}

// Cache interno do worker
const manifestCache = new Map<string, { data: string; timestamp: number }>();
const segmentCache = new Map<string, { size: number; timestamp: number }>();
const CACHE_TTL = 30000; // 30 segundos

// Fila de prioridade
const queue: PreloadTask[] = [];
let isProcessing = false;
const MAX_CONCURRENT = 4;
let activeRequests = 0;

// Limpa cache expirado
function cleanExpiredCache() {
  const now = Date.now();
  
  manifestCache.forEach((entry, url) => {
    if (now - entry.timestamp > CACHE_TTL) {
      manifestCache.delete(url);
    }
  });
  
  segmentCache.forEach((entry, url) => {
    if (now - entry.timestamp > CACHE_TTL) {
      segmentCache.delete(url);
    }
  });
}

// Processa um item da fila
async function processTask(task: PreloadTask): Promise<PreloadResult> {
  const startTime = performance.now();
  
  try {
    // Verifica cache primeiro
    if (task.type === 'manifest' && manifestCache.has(task.url)) {
      const cached = manifestCache.get(task.url)!;
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        return {
          id: task.id,
          url: task.url,
          success: true,
          data: cached.data,
          duration: 0,
        };
      }
    }
    
    if (task.type === 'segment' && segmentCache.has(task.url)) {
      const cached = segmentCache.get(task.url)!;
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        return {
          id: task.id,
          url: task.url,
          success: true,
          size: cached.size,
          duration: 0,
        };
      }
    }
    
    // Fetch com timeout agressivo
    const controller = new AbortController();
    const timeout = task.type === 'manifest' ? 5000 : 8000;
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(task.url, {
      signal: controller.signal,
      headers: {
        'Accept': task.type === 'manifest' ? 'application/vnd.apple.mpegurl,*/*' : '*/*',
      },
      cache: 'force-cache',
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const duration = performance.now() - startTime;
    
    if (task.type === 'manifest') {
      const data = await response.text();
      
      // Cacheia manifesto
      manifestCache.set(task.url, {
        data,
        timestamp: Date.now(),
      });
      
      // Extrai URLs de segmentos para preload
      const segmentUrls = extractSegmentUrls(task.url, data);
      
      return {
        id: task.id,
        url: task.url,
        success: true,
        data,
        size: data.length,
        duration,
      };
    } else {
      // Para segmentos, fazemos range request inicial apenas
      const size = parseInt(response.headers.get('content-length') || '0', 10);
      
      segmentCache.set(task.url, {
        size,
        timestamp: Date.now(),
      });
      
      return {
        id: task.id,
        url: task.url,
        success: true,
        size,
        duration,
      };
    }
  } catch (error) {
    return {
      id: task.id,
      url: task.url,
      success: false,
      error: (error as Error).message,
      duration: performance.now() - startTime,
    };
  }
}

// Extrai URLs de segmentos do manifesto
function extractSegmentUrls(manifestUrl: string, content: string): string[] {
  const urls: string[] = [];
  const lines = content.split('\n');
  const baseUrl = manifestUrl.substring(0, manifestUrl.lastIndexOf('/') + 1);
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      if (trimmed.startsWith('http')) {
        urls.push(trimmed);
      } else {
        urls.push(baseUrl + trimmed);
      }
    }
  }
  
  // Retorna apenas os primeiros 3 segmentos (mais importantes)
  return urls.slice(0, 3);
}

// Processa a fila com prioridade
async function processQueue() {
  if (isProcessing || queue.length === 0) return;
  
  isProcessing = true;
  cleanExpiredCache();
  
  // Ordena por prioridade
  queue.sort((a, b) => {
    const priority = { high: 0, medium: 1, low: 2 };
    return priority[a.priority] - priority[b.priority];
  });
  
  while (queue.length > 0 && activeRequests < MAX_CONCURRENT) {
    const task = queue.shift();
    if (!task) break;
    
    activeRequests++;
    
    processTask(task)
      .then(result => {
        self.postMessage({ type: 'result', payload: result });
      })
      .finally(() => {
        activeRequests--;
        if (queue.length > 0) {
          processQueue();
        }
      });
  }
  
  isProcessing = false;
}

// Handler de mensagens
self.onmessage = (event) => {
  const { type, payload } = event.data;
  
  switch (type) {
    case 'preload':
      queue.push(payload as PreloadTask);
      processQueue();
      break;
      
    case 'preloadBatch':
      const tasks = payload as PreloadTask[];
      queue.push(...tasks);
      processQueue();
      break;
      
    case 'cancel':
      // Remove tasks da fila por URL
      const urlToCancel = payload.url;
      const index = queue.findIndex(t => t.url === urlToCancel);
      if (index !== -1) {
        queue.splice(index, 1);
      }
      break;
      
    case 'clear':
      queue.length = 0;
      manifestCache.clear();
      segmentCache.clear();
      break;
      
    case 'getStats':
      self.postMessage({
        type: 'stats',
        payload: {
          queueSize: queue.length,
          manifestCacheSize: manifestCache.size,
          segmentCacheSize: segmentCache.size,
          activeRequests,
        },
      });
      break;
      
    case 'getCached':
      const cachedManifest = manifestCache.get(payload.url);
      self.postMessage({
        type: 'cached',
        payload: {
          url: payload.url,
          exists: !!cachedManifest,
          data: cachedManifest?.data,
        },
      });
      break;
  }
};

// Notifica que o worker está pronto
self.postMessage({ type: 'ready' });
