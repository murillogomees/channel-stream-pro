/**
 * ============================================================================
 * M3U Validator - Validação Avançada de Playlists
 * ============================================================================
 * 
 * Sistema de validação completo para playlists M3U:
 * - Validação estrutural
 * - Validação de URLs
 * - Detecção de duplicatas
 * - Análise de qualidade
 * - Health check de streams
 * 
 * @version 1.0.0
 */

import type { M3UChannel, M3UParseResult } from './M3UParser';

// =============================================================================
// TYPES
// =============================================================================

export interface ValidationResult {
  isValid: boolean;
  score: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  errors: ValidationError[];
  warnings: ValidationWarning[];
  stats: ValidationStats;
}

export interface ValidationError {
  code: string;
  message: string;
  channelId?: string;
  line?: number;
  severity: 'critical' | 'error';
}

export interface ValidationWarning {
  code: string;
  message: string;
  channelId?: string;
  suggestion?: string;
}

export interface ValidationStats {
  totalChannels: number;
  validChannels: number;
  invalidChannels: number;
  duplicateChannels: number;
  categoriesCount: number;
  averageChannelsPerCategory: number;
  urlProtocols: Record<string, number>;
  streamTypes: Record<string, number>;
}

export interface StreamHealthResult {
  url: string;
  isHealthy: boolean;
  responseTime: number;
  statusCode: number;
  contentType: string | null;
  error?: string;
}

// =============================================================================
// VALIDATOR CLASS
// =============================================================================

export class M3UValidator {
  /**
   * Validate parsed M3U result
   */
  validate(parseResult: M3UParseResult): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Structural validation
    this.validateStructure(parseResult, errors, warnings);

    // Channel validation
    this.validateChannels(parseResult.channels, errors, warnings);

    // Duplicate detection
    const duplicates = this.findDuplicates(parseResult.channels);
    if (duplicates.length > 0) {
      warnings.push({
        code: 'DUPLICATE_CHANNELS',
        message: `Found ${duplicates.length} duplicate channels`,
        suggestion: 'Consider removing duplicate entries',
      });
    }

    // Calculate stats
    const stats = this.calculateStats(parseResult, duplicates.length);

    // Calculate score and grade
    const score = this.calculateScore(errors, warnings, stats);
    const grade = this.scoreToGrade(score);

    return {
      isValid: errors.filter(e => e.severity === 'critical').length === 0,
      score,
      grade,
      errors,
      warnings,
      stats,
    };
  }

  /**
   * Validate M3U structure
   */
  private validateStructure(
    parseResult: M3UParseResult, 
    errors: ValidationError[], 
    warnings: ValidationWarning[]
  ): void {
    // Check for parse errors
    if (parseResult.errors.length > 0) {
      for (const error of parseResult.errors) {
        errors.push({
          code: 'PARSE_ERROR',
          message: error,
          severity: 'error',
        });
      }
    }

    // Check minimum channels
    if (parseResult.totalChannels === 0) {
      errors.push({
        code: 'EMPTY_PLAYLIST',
        message: 'Playlist is empty - no channels found',
        severity: 'critical',
      });
    } else if (parseResult.totalChannels < 5) {
      warnings.push({
        code: 'FEW_CHANNELS',
        message: `Only ${parseResult.totalChannels} channels found`,
        suggestion: 'Check if the playlist was parsed correctly',
      });
    }

    // Check categories
    if (parseResult.categories.length === 0 && parseResult.totalChannels > 0) {
      warnings.push({
        code: 'NO_CATEGORIES',
        message: 'No categories defined in playlist',
        suggestion: 'Add group-title attributes to organize channels',
      });
    }

    // Check invalid channels ratio
    const invalidRatio = parseResult.invalidChannels / parseResult.totalChannels;
    if (invalidRatio > 0.3) {
      errors.push({
        code: 'HIGH_INVALID_RATIO',
        message: `${Math.round(invalidRatio * 100)}% of channels are invalid`,
        severity: 'error',
      });
    } else if (invalidRatio > 0.1) {
      warnings.push({
        code: 'INVALID_CHANNELS',
        message: `${parseResult.invalidChannels} channels have validation errors`,
      });
    }
  }

  /**
   * Validate individual channels
   */
  private validateChannels(
    channels: M3UChannel[], 
    errors: ValidationError[], 
    warnings: ValidationWarning[]
  ): void {
    const seenUrls = new Set<string>();

    for (const channel of channels) {
      // Check for channel-level validation errors
      if (channel.validationErrors.length > 0) {
        for (const error of channel.validationErrors) {
          errors.push({
            code: 'CHANNEL_INVALID',
            message: `${channel.name}: ${error}`,
            channelId: channel.id,
            severity: 'error',
          });
        }
      }

      // URL format warnings
      if (channel.url.startsWith('http://')) {
        warnings.push({
          code: 'HTTP_URL',
          message: `${channel.name} uses HTTP (not secure)`,
          channelId: channel.id,
          suggestion: 'Consider using HTTPS URLs',
        });
      }

      // Missing metadata warnings
      if (!channel.logo) {
        // Only warn for first 10 missing logos to avoid spam
        if (warnings.filter(w => w.code === 'MISSING_LOGO').length < 10) {
          warnings.push({
            code: 'MISSING_LOGO',
            message: `${channel.name} has no logo`,
            channelId: channel.id,
          });
        }
      }

      // Track URLs for duplicate detection
      seenUrls.add(channel.url);
    }
  }

  /**
   * Find duplicate channels
   */
  private findDuplicates(channels: M3UChannel[]): M3UChannel[] {
    const urlMap = new Map<string, M3UChannel[]>();
    
    for (const channel of channels) {
      const normalizedUrl = channel.url.toLowerCase().replace(/\/+$/, '');
      if (!urlMap.has(normalizedUrl)) {
        urlMap.set(normalizedUrl, []);
      }
      urlMap.get(normalizedUrl)!.push(channel);
    }

    const duplicates: M3UChannel[] = [];
    for (const [, channelList] of urlMap) {
      if (channelList.length > 1) {
        duplicates.push(...channelList.slice(1));
      }
    }

    return duplicates;
  }

  /**
   * Calculate validation stats
   */
  private calculateStats(parseResult: M3UParseResult, duplicateCount: number): ValidationStats {
    const urlProtocols: Record<string, number> = {};
    const streamTypes: Record<string, number> = {};

    for (const channel of parseResult.channels) {
      try {
        const url = new URL(channel.url);
        const protocol = url.protocol.replace(':', '');
        urlProtocols[protocol] = (urlProtocols[protocol] || 0) + 1;

        // Detect stream type
        const path = url.pathname.toLowerCase();
        if (path.includes('.m3u8')) {
          streamTypes['HLS'] = (streamTypes['HLS'] || 0) + 1;
        } else if (path.includes('.mpd')) {
          streamTypes['DASH'] = (streamTypes['DASH'] || 0) + 1;
        } else if (path.includes('.ts')) {
          streamTypes['MPEG-TS'] = (streamTypes['MPEG-TS'] || 0) + 1;
        } else {
          streamTypes['Other'] = (streamTypes['Other'] || 0) + 1;
        }
      } catch {
        streamTypes['Invalid'] = (streamTypes['Invalid'] || 0) + 1;
      }
    }

    return {
      totalChannels: parseResult.totalChannels,
      validChannels: parseResult.validChannels,
      invalidChannels: parseResult.invalidChannels,
      duplicateChannels: duplicateCount,
      categoriesCount: parseResult.categories.length,
      averageChannelsPerCategory: parseResult.categories.length > 0 
        ? Math.round(parseResult.totalChannels / parseResult.categories.length) 
        : 0,
      urlProtocols,
      streamTypes,
    };
  }

  /**
   * Calculate quality score (0-100)
   */
  private calculateScore(
    errors: ValidationError[], 
    warnings: ValidationWarning[], 
    stats: ValidationStats
  ): number {
    let score = 100;

    // Critical errors = -30 each (max -60)
    const criticalCount = errors.filter(e => e.severity === 'critical').length;
    score -= Math.min(criticalCount * 30, 60);

    // Regular errors = -10 each (max -20)
    const errorCount = errors.filter(e => e.severity === 'error').length;
    score -= Math.min(errorCount * 10, 20);

    // Warnings = -2 each (max -10)
    score -= Math.min(warnings.length * 2, 10);

    // Invalid channel ratio penalty
    if (stats.totalChannels > 0) {
      const invalidRatio = stats.invalidChannels / stats.totalChannels;
      score -= Math.round(invalidRatio * 20);
    }

    // Bonus for having categories
    if (stats.categoriesCount > 1) {
      score += 5;
    }

    // Bonus for HTTPS usage
    const httpsRatio = (stats.urlProtocols['https'] || 0) / stats.totalChannels;
    if (httpsRatio > 0.5) {
      score += 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Convert score to letter grade
   */
  private scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  /**
   * Check stream health (async)
   */
  async checkStreamHealth(
    url: string, 
    timeout = 5000
  ): Promise<StreamHealthResult> {
    const startTime = performance.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'VLC/3.0.21 LibVLC/3.0.21',
        },
      });

      clearTimeout(timeoutId);
      const responseTime = performance.now() - startTime;

      return {
        url,
        isHealthy: response.ok,
        responseTime,
        statusCode: response.status,
        contentType: response.headers.get('Content-Type'),
      };
    } catch (error) {
      return {
        url,
        isHealthy: false,
        responseTime: performance.now() - startTime,
        statusCode: 0,
        contentType: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Batch check multiple streams
   */
  async checkMultipleStreams(
    urls: string[], 
    options: { timeout?: number; concurrency?: number } = {}
  ): Promise<StreamHealthResult[]> {
    const { timeout = 5000, concurrency = 5 } = options;
    const results: StreamHealthResult[] = [];

    for (let i = 0; i < urls.length; i += concurrency) {
      const batch = urls.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(url => this.checkStreamHealth(url, timeout))
      );
      results.push(...batchResults);
    }

    return results;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export const m3uValidator = new M3UValidator();

export function validateM3U(parseResult: M3UParseResult): ValidationResult {
  return m3uValidator.validate(parseResult);
}

export default M3UValidator;
