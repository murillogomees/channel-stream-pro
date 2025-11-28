/**
 * VOD Detection Service
 * 
 * Detecta automaticamente se um canal é VOD (Video on Demand) ou Live
 * baseado em padrões de URL, categoria e nome
 */

export interface DetectionResult {
  isVOD: boolean;
  contentType: 'live' | 'vod' | 'unknown';
  confidence: number;
  reason: string;
}

// Padrões para detectar VOD
const VOD_URL_PATTERNS = [
  /\/movie\//i,
  /\/movies\//i,
  /\/series\//i,
  /\/vod\//i,
  /\/film\//i,
  /\/video\//i,
  /\.mp4(\?|$)/i,
  /\.mkv(\?|$)/i,
  /\.avi(\?|$)/i,
];

const VOD_CATEGORY_PATTERNS = [
  /filme/i,
  /movie/i,
  /cinema/i,
  /vod/i,
  /série/i,
  /series/i,
  /seriado/i,
  /novela/i,
  /temporada/i,
  /season/i,
  /episódio/i,
  /episode/i,
  /drama/i,
  /dorama/i,
  /anime/i,
  /animação/i,
  /cartoon/i,
  /documentário/i,
  /documentary/i,
];

const LIVE_URL_PATTERNS = [
  /\/live\//i,
  /\/ao-vivo\//i,
  /\/stream\//i,
  /\.m3u8(\?|$)/i,
  /\/hls\//i,
];

const LIVE_CATEGORY_PATTERNS = [
  /ao vivo/i,
  /live/i,
  /canal/i,
  /channel/i,
  /tv /i,
  /televisão/i,
  /notícia/i,
  /news/i,
  /esporte/i,
  /sport/i,
  /football/i,
  /futebol/i,
];

/**
 * Detecta se um canal é VOD ou Live
 */
export function detectContentType(
  streamUrl: string,
  categoryName?: string,
  channelName?: string
): DetectionResult {
  let vodScore = 0;
  let liveScore = 0;
  const reasons: string[] = [];

  // Analisar URL
  for (const pattern of VOD_URL_PATTERNS) {
    if (pattern.test(streamUrl)) {
      vodScore += 30;
      reasons.push(`URL contém padrão VOD: ${pattern.source}`);
    }
  }

  for (const pattern of LIVE_URL_PATTERNS) {
    if (pattern.test(streamUrl)) {
      liveScore += 30;
      reasons.push(`URL contém padrão Live: ${pattern.source}`);
    }
  }

  // Analisar categoria
  if (categoryName) {
    for (const pattern of VOD_CATEGORY_PATTERNS) {
      if (pattern.test(categoryName)) {
        vodScore += 40;
        reasons.push(`Categoria indica VOD: ${categoryName}`);
        break; // Só conta uma vez
      }
    }

    for (const pattern of LIVE_CATEGORY_PATTERNS) {
      if (pattern.test(categoryName)) {
        liveScore += 40;
        reasons.push(`Categoria indica Live: ${categoryName}`);
        break;
      }
    }
  }

  // Analisar nome do canal para séries (padrões S01E01, etc)
  if (channelName) {
    const seriesPatterns = [
      /S\d{1,2}E\d{1,3}/i,
      /\d{1,2}x\d{1,3}/i,
      /Temporada\s*\d+/i,
      /Season\s*\d+/i,
      /Ep[is]*[óo]*d?i?o?\s*\d+/i,
      /Cap[íi]tulo\s*\d+/i,
    ];

    for (const pattern of seriesPatterns) {
      if (pattern.test(channelName)) {
        vodScore += 50;
        reasons.push(`Nome indica série/episódio: ${channelName}`);
        break;
      }
    }
  }

  // Determinar resultado
  const totalScore = vodScore + liveScore;
  const confidence = totalScore > 0 
    ? Math.round((Math.max(vodScore, liveScore) / totalScore) * 100)
    : 0;

  if (vodScore > liveScore && vodScore >= 30) {
    return {
      isVOD: true,
      contentType: 'vod',
      confidence,
      reason: reasons.join('; '),
    };
  }

  if (liveScore > vodScore && liveScore >= 30) {
    return {
      isVOD: false,
      contentType: 'live',
      confidence,
      reason: reasons.join('; '),
    };
  }

  return {
    isVOD: false,
    contentType: 'unknown',
    confidence: 0,
    reason: 'Não foi possível determinar o tipo de conteúdo',
  };
}

/**
 * Detecta VOD em lote
 */
export function detectBatch(
  channels: Array<{
    id: string;
    stream_url: string;
    group_title?: string;
    name?: string;
  }>
): Map<string, DetectionResult> {
  const results = new Map<string, DetectionResult>();

  for (const channel of channels) {
    const result = detectContentType(
      channel.stream_url,
      channel.group_title,
      channel.name
    );
    results.set(channel.id, result);
  }

  return results;
}

/**
 * Estima se conteúdo deve ser priorizado para download no R2
 * Baseado em tipo (VOD), tamanho estimado e popularidade
 */
export function shouldPrioritizeForCDN(
  detection: DetectionResult,
  estimatedSizeMB?: number,
  viewCount?: number
): { shouldDownload: boolean; priority: 'high' | 'medium' | 'low'; reason: string } {
  // Só considerar VOD
  if (!detection.isVOD) {
    return {
      shouldDownload: false,
      priority: 'low',
      reason: 'Conteúdo Live não deve ser baixado para CDN',
    };
  }

  // Se é muito grande, baixar prioridade
  if (estimatedSizeMB && estimatedSizeMB > 5000) {
    return {
      shouldDownload: true,
      priority: 'low',
      reason: 'Arquivo muito grande - baixa prioridade',
    };
  }

  // Se é popular, alta prioridade
  if (viewCount && viewCount > 10) {
    return {
      shouldDownload: true,
      priority: 'high',
      reason: `Conteúdo popular com ${viewCount} visualizações`,
    };
  }

  // VOD com boa confiança
  if (detection.confidence >= 70) {
    return {
      shouldDownload: true,
      priority: 'medium',
      reason: `VOD detectado com ${detection.confidence}% de confiança`,
    };
  }

  return {
    shouldDownload: true,
    priority: 'low',
    reason: 'VOD detectado com baixa confiança',
  };
}
