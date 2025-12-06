/**
 * M3U Series Validation Service
 * Validates and normalizes M3U content for series/episodes before generation
 * 
 * Padrão obrigatório de formatação:
 * #EXTM3U
 * #EXTINF:-1 tvg-id="<serie>.sXXeYY" tvg-name="<Nome da Série>" tvg-season="X" tvg-episode="Y" group-title="<Nome da Série>", SXXEYY - <Título>
 * <URL do episódio>
 */

export interface SeriesEpisode {
  id: string;
  seriesName: string;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string;
  url: string;
  logo?: string;
  originalEntry?: any;
  quality?: 'SD' | 'HD' | '4K' | 'unknown';
}

export interface ValidationIssue {
  type: 'error' | 'warning' | 'info' | 'duplicate';
  message: string;
  details?: string;
  affectedEpisodes?: SeriesEpisode[];
  suggestedFix?: string;
}

export interface DuplicateGroup {
  key: string;
  episodes: SeriesEpisode[];
  recommended: SeriesEpisode;
}

export interface SeriesValidationResult {
  valid: boolean;
  requiresConfirmation: boolean;
  totalEpisodes: number;
  validEpisodes: number;
  invalidEpisodes: number;
  duplicatesFound: number;
  duplicateGroups: DuplicateGroup[];
  issues: ValidationIssue[];
  normalizedEpisodes: SeriesEpisode[];
  preview: string;
  stats: {
    series: Map<string, number>;
    seasons: Map<string, number[]>;
    missingInfo: number;
    urlsInvalid: number;
    formatErrors: number;
  };
}

// Regex patterns for episode detection
const EPISODE_PATTERNS = [
  // S01E01, S1E1, etc.
  /[Ss](\d{1,2})[Ee](\d{1,3})/,
  // 1x01, 1X01, etc.
  /(\d{1,2})[xX](\d{1,3})/,
  // Season 1 Episode 1
  /[Ss]eason\s*(\d{1,2}).*[Ee]pisode\s*(\d{1,3})/i,
  // Temporada 1 Episodio 1
  /[Tt]emporada\s*(\d{1,2}).*[Ee]pis[oó]dio\s*(\d{1,3})/i,
  // T01E01
  /[Tt](\d{1,2})[Ee](\d{1,3})/,
  // EP01, Ep 01
  /[Ee][Pp]\s*(\d{1,3})/,
  // E01 standalone
  /\s[Ee](\d{1,3})(?:\s|$|-)/,
];

// Quality detection patterns
const QUALITY_PATTERNS = {
  '4K': /\b(4[Kk]|UHD|2160[pP])\b/,
  'HD': /\b(HD|1080[pP]|720[pP]|FHD)\b/,
  'SD': /\b(SD|480[pP]|360[pP])\b/,
};

class M3USeriesValidationService {
  /**
   * Parse episode info from title string
   */
  private parseEpisodeInfo(title: string): { season: number; episode: number; seriesName: string; episodeTitle: string } | null {
    let season = 0;
    let episode = 0;
    let matched = false;

    for (const pattern of EPISODE_PATTERNS) {
      const match = title.match(pattern);
      if (match) {
        if (match[2]) {
          season = parseInt(match[1], 10);
          episode = parseInt(match[2], 10);
        } else if (match[1]) {
          episode = parseInt(match[1], 10);
          season = 1; // Default season if only episode found
        }
        matched = true;
        break;
      }
    }

    if (!matched) return null;

    // Extract series name (before S01E01 pattern)
    let seriesName = title;
    for (const pattern of EPISODE_PATTERNS) {
      seriesName = seriesName.replace(pattern, '|SPLIT|');
    }
    const parts = seriesName.split('|SPLIT|');
    seriesName = parts[0].trim()
      .replace(/[-_.:]+$/, '')
      .replace(/^\s*[-_.:]+/, '')
      .trim();

    // Extract episode title (after S01E01 pattern)
    let episodeTitle = parts[1] || '';
    episodeTitle = episodeTitle.trim()
      .replace(/^[-_.:]+\s*/, '')
      .replace(/\s*[-_.:]+$/, '')
      .trim();

    return { season, episode, seriesName, episodeTitle };
  }

  /**
   * Detect video quality from URL or title
   */
  private detectQuality(url: string, title: string): 'SD' | 'HD' | '4K' | 'unknown' {
    const combined = `${url} ${title}`;
    
    if (QUALITY_PATTERNS['4K'].test(combined)) return '4K';
    if (QUALITY_PATTERNS['HD'].test(combined)) return 'HD';
    if (QUALITY_PATTERNS['SD'].test(combined)) return 'SD';
    
    return 'unknown';
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:', 'rtmp:', 'rtsp:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  /**
   * Format season/episode numbers with padding
   */
  private formatSeasonEpisode(season: number, episode: number): string {
    const s = season.toString().padStart(2, '0');
    const e = episode.toString().padStart(2, '0');
    return `S${s}E${e}`;
  }

  /**
   * Validate M3U entries for series content
   */
  async validateSeriesEntries(entries: any[]): Promise<SeriesValidationResult> {
    const issues: ValidationIssue[] = [];
    const normalizedEpisodes: SeriesEpisode[] = [];
    const seriesMap = new Map<string, number>();
    const seasonsMap = new Map<string, number[]>();
    let missingInfo = 0;
    let urlsInvalid = 0;
    let formatErrors = 0;

    // Phase 1: Parse and normalize all entries
    for (const entry of entries) {
      const title = entry.title || entry.name || '';
      const url = entry.stream_url || entry.url || '';
      const logo = entry.tvg_logo || entry.logo || '';

      // Validate URL
      if (!this.isValidUrl(url)) {
        urlsInvalid++;
        issues.push({
          type: 'warning',
          message: `URL inválida para: ${title}`,
          details: url || 'URL vazia',
        });
        continue;
      }

      // Parse episode info
      const episodeInfo = this.parseEpisodeInfo(title);
      
      if (!episodeInfo) {
        missingInfo++;
        issues.push({
          type: 'info',
          message: `Padrão de episódio não detectado: ${title}`,
          suggestedFix: 'Adicione informação de temporada/episódio no formato S01E01',
        });
        // Still include but with default values
        normalizedEpisodes.push({
          id: entry.id || crypto.randomUUID(),
          seriesName: entry.group_title || 'Desconhecido',
          seasonNumber: 0,
          episodeNumber: 0,
          episodeTitle: title,
          url,
          logo,
          originalEntry: entry,
          quality: this.detectQuality(url, title),
        });
        continue;
      }

      // Track series and seasons
      const { season, episode, seriesName, episodeTitle } = episodeInfo;
      seriesMap.set(seriesName, (seriesMap.get(seriesName) || 0) + 1);
      
      const seriesSeasons = seasonsMap.get(seriesName) || [];
      if (!seriesSeasons.includes(season)) {
        seriesSeasons.push(season);
        seasonsMap.set(seriesName, seriesSeasons);
      }

      normalizedEpisodes.push({
        id: entry.id || crypto.randomUUID(),
        seriesName: seriesName || entry.group_title || 'Desconhecido',
        seasonNumber: season,
        episodeNumber: episode,
        episodeTitle: episodeTitle || title,
        url,
        logo,
        originalEntry: entry,
        quality: this.detectQuality(url, title),
      });
    }

    // Phase 2: Detect duplicates
    const duplicateGroups = this.detectDuplicates(normalizedEpisodes);
    
    if (duplicateGroups.length > 0) {
      issues.push({
        type: 'duplicate',
        message: `${duplicateGroups.length} grupos de episódios duplicados detectados`,
        details: duplicateGroups.map(g => g.key).slice(0, 5).join(', ') + (duplicateGroups.length > 5 ? '...' : ''),
      });
    }

    // Phase 3: Validate ordering and gaps
    const orderingIssues = this.validateOrdering(normalizedEpisodes, seriesMap, seasonsMap);
    issues.push(...orderingIssues);

    // Phase 4: Sort normalized episodes
    const sortedEpisodes = this.sortEpisodes(normalizedEpisodes);

    // Phase 5: Generate preview M3U
    const preview = this.generatePreviewM3U(sortedEpisodes.slice(0, 20));

    // Calculate validation result
    const hasErrors = issues.some(i => i.type === 'error');
    const hasDuplicates = duplicateGroups.length > 0;
    const hasWarnings = issues.some(i => i.type === 'warning');

    return {
      valid: !hasErrors,
      requiresConfirmation: hasDuplicates || hasWarnings || missingInfo > 0,
      totalEpisodes: entries.length,
      validEpisodes: normalizedEpisodes.length,
      invalidEpisodes: urlsInvalid,
      duplicatesFound: duplicateGroups.reduce((acc, g) => acc + g.episodes.length - 1, 0),
      duplicateGroups,
      issues,
      normalizedEpisodes: sortedEpisodes,
      preview,
      stats: {
        series: seriesMap,
        seasons: seasonsMap,
        missingInfo,
        urlsInvalid,
        formatErrors,
      },
    };
  }

  /**
   * Detect duplicate episodes
   */
  private detectDuplicates(episodes: SeriesEpisode[]): DuplicateGroup[] {
    const groups = new Map<string, SeriesEpisode[]>();

    for (const ep of episodes) {
      if (ep.seasonNumber === 0 && ep.episodeNumber === 0) continue;
      
      const key = `${ep.seriesName.toLowerCase()}|S${ep.seasonNumber}E${ep.episodeNumber}`;
      const group = groups.get(key) || [];
      group.push(ep);
      groups.set(key, group);
    }

    const duplicateGroups: DuplicateGroup[] = [];

    for (const [key, eps] of groups) {
      if (eps.length > 1) {
        // Select recommended episode (prefer higher quality, then shorter URL)
        const sorted = [...eps].sort((a, b) => {
          const qualityOrder = { '4K': 0, 'HD': 1, 'SD': 2, 'unknown': 3 };
          const qDiff = qualityOrder[a.quality || 'unknown'] - qualityOrder[b.quality || 'unknown'];
          if (qDiff !== 0) return qDiff;
          return a.url.length - b.url.length;
        });

        duplicateGroups.push({
          key,
          episodes: eps,
          recommended: sorted[0],
        });
      }
    }

    return duplicateGroups;
  }

  /**
   * Validate episode ordering and detect gaps
   */
  private validateOrdering(
    episodes: SeriesEpisode[],
    seriesMap: Map<string, number>,
    seasonsMap: Map<string, number[]>
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const [seriesName, seasons] of seasonsMap) {
      const sortedSeasons = [...seasons].sort((a, b) => a - b);
      
      // Check for season gaps
      for (let i = 1; i < sortedSeasons.length; i++) {
        if (sortedSeasons[i] - sortedSeasons[i - 1] > 1) {
          issues.push({
            type: 'warning',
            message: `Lacuna de temporada detectada em "${seriesName}"`,
            details: `Temporada ${sortedSeasons[i - 1] + 1} está faltando`,
          });
        }
      }

      // Check for episode gaps within each season
      for (const season of sortedSeasons) {
        const seasonEpisodes = episodes
          .filter(e => e.seriesName.toLowerCase() === seriesName.toLowerCase() && e.seasonNumber === season)
          .map(e => e.episodeNumber)
          .filter(n => n > 0)
          .sort((a, b) => a - b);

        if (seasonEpisodes.length > 0) {
          const maxEp = Math.max(...seasonEpisodes);
          const missingEps: number[] = [];
          
          for (let i = 1; i <= maxEp; i++) {
            if (!seasonEpisodes.includes(i)) {
              missingEps.push(i);
            }
          }

          if (missingEps.length > 0 && missingEps.length <= 5) {
            issues.push({
              type: 'info',
              message: `Episódios faltando em "${seriesName}" S${season.toString().padStart(2, '0')}`,
              details: `Episódios: ${missingEps.map(e => e.toString().padStart(2, '0')).join(', ')}`,
            });
          }
        }
      }
    }

    return issues;
  }

  /**
   * Sort episodes by series, season, episode
   */
  private sortEpisodes(episodes: SeriesEpisode[]): SeriesEpisode[] {
    return [...episodes].sort((a, b) => {
      // Sort by series name
      const seriesCompare = a.seriesName.localeCompare(b.seriesName, 'pt-BR');
      if (seriesCompare !== 0) return seriesCompare;

      // Sort by season
      if (a.seasonNumber !== b.seasonNumber) {
        return a.seasonNumber - b.seasonNumber;
      }

      // Sort by episode
      return a.episodeNumber - b.episodeNumber;
    });
  }

  /**
   * Generate standardized M3U content
   */
  generateStandardizedM3U(episodes: SeriesEpisode[], removeDuplicates: boolean = true): string {
    let m3uContent = '#EXTM3U\n\n';
    
    // Remove duplicates if requested
    let processedEpisodes = episodes;
    if (removeDuplicates) {
      const seen = new Set<string>();
      processedEpisodes = episodes.filter(ep => {
        if (ep.seasonNumber === 0 && ep.episodeNumber === 0) return true;
        const key = `${ep.seriesName.toLowerCase()}|S${ep.seasonNumber}E${ep.episodeNumber}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    // Sort episodes
    const sorted = this.sortEpisodes(processedEpisodes);

    for (const ep of sorted) {
      const seasonStr = ep.seasonNumber > 0 ? ep.seasonNumber.toString().padStart(2, '0') : '01';
      const episodeStr = ep.episodeNumber > 0 ? ep.episodeNumber.toString().padStart(2, '0') : '01';
      const seCode = `S${seasonStr}E${episodeStr}`;
      
      const tvgId = `${ep.seriesName.toLowerCase().replace(/\s+/g, '_')}.s${seasonStr}e${episodeStr}`;
      const tvgName = ep.seriesName;
      const tvgLogo = ep.logo ? ` tvg-logo="${ep.logo}"` : '';
      
      const displayTitle = ep.episodeTitle 
        ? `${seCode} - ${ep.episodeTitle}`
        : seCode;

      m3uContent += `#EXTINF:-1 tvg-id="${tvgId}" tvg-name="${tvgName}" tvg-season="${ep.seasonNumber || 1}" tvg-episode="${ep.episodeNumber || 1}" group-title="${ep.seriesName}"${tvgLogo},${displayTitle}\n`;
      m3uContent += `${ep.url}\n\n`;
    }

    return m3uContent;
  }

  /**
   * Generate preview M3U (first N episodes)
   */
  private generatePreviewM3U(episodes: SeriesEpisode[]): string {
    if (episodes.length === 0) return '#EXTM3U\n\n# Nenhum episódio para preview';
    return this.generateStandardizedM3U(episodes, false);
  }

  /**
   * Apply duplicate resolution
   */
  resolveDuplicates(episodes: SeriesEpisode[], keepRecommended: boolean = true): SeriesEpisode[] {
    if (keepRecommended) {
      const duplicateGroups = this.detectDuplicates(episodes);
      const toRemove = new Set<string>();

      for (const group of duplicateGroups) {
        for (const ep of group.episodes) {
          if (ep.id !== group.recommended.id) {
            toRemove.add(ep.id);
          }
        }
      }

      return episodes.filter(ep => !toRemove.has(ep.id));
    }

    return episodes;
  }
}

export const m3uSeriesValidationService = new M3USeriesValidationService();
