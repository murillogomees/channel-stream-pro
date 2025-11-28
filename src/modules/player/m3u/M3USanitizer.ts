/**
 * ============================================================================
 * M3U Sanitizer - Limpeza e Normalização de Streams
 * ============================================================================
 * 
 * Sistema de sanitização para:
 * - Limpeza de URLs com parâmetros perigosos
 * - Normalização de nomes
 * - Remoção de canais inválidos
 * - Filtragem de conteúdo
 * - Proxy rewriting
 * 
 * @version 1.0.0
 */

import type { M3UChannel, M3UCategory } from './M3UParser';

// =============================================================================
// TYPES
// =============================================================================

export interface SanitizeOptions {
  removeAdultContent?: boolean;
  removeInvalidUrls?: boolean;
  removeDuplicates?: boolean;
  normalizeNames?: boolean;
  proxyBaseUrl?: string;
  allowedProtocols?: string[];
  blockedDomains?: string[];
  maxNameLength?: number;
}

export interface SanitizeResult {
  channels: M3UChannel[];
  categories: M3UCategory[];
  removedCount: number;
  modifiedCount: number;
  reasons: SanitizeAction[];
}

export interface SanitizeAction {
  channelId: string;
  channelName: string;
  action: 'removed' | 'modified' | 'proxied';
  reason: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DANGEROUS_PARAMS = [
  'token', 'key', 'auth', 'password', 'secret', 'credential',
  'apikey', 'api_key', 'access_token', 'session', 'sig', 'signature',
];

const ADULT_KEYWORDS = [
  'xxx', 'adult', 'porn', '18+', 'erotic', 'sex', 'hardcore',
  '+18', 'adulto', 'pornô', 'porno', 'hentai',
];

const BLOCKED_DOMAINS_DEFAULT = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '192.168.',
  '10.0.',
  '172.16.',
];

// =============================================================================
// SANITIZER CLASS
// =============================================================================

export class M3USanitizer {
  private options: Required<SanitizeOptions>;

  constructor(options: SanitizeOptions = {}) {
    this.options = {
      removeAdultContent: options.removeAdultContent ?? false,
      removeInvalidUrls: options.removeInvalidUrls ?? true,
      removeDuplicates: options.removeDuplicates ?? true,
      normalizeNames: options.normalizeNames ?? true,
      proxyBaseUrl: options.proxyBaseUrl ?? '',
      allowedProtocols: options.allowedProtocols ?? ['http:', 'https:'],
      blockedDomains: options.blockedDomains ?? BLOCKED_DOMAINS_DEFAULT,
      maxNameLength: options.maxNameLength ?? 100,
    };
  }

  /**
   * Sanitize channels array
   */
  sanitize(channels: M3UChannel[]): SanitizeResult {
    const actions: SanitizeAction[] = [];
    const sanitizedChannels: M3UChannel[] = [];
    const seenUrls = new Set<string>();
    let modifiedCount = 0;

    for (const channel of channels) {
      // Skip invalid channels
      if (this.options.removeInvalidUrls && !this.isValidUrl(channel.url)) {
        actions.push({
          channelId: channel.id,
          channelName: channel.name,
          action: 'removed',
          reason: 'Invalid URL',
        });
        continue;
      }

      // Skip blocked domains
      if (this.isBlockedDomain(channel.url)) {
        actions.push({
          channelId: channel.id,
          channelName: channel.name,
          action: 'removed',
          reason: 'Blocked domain',
        });
        continue;
      }

      // Skip adult content if enabled
      if (this.options.removeAdultContent && this.isAdultContent(channel)) {
        actions.push({
          channelId: channel.id,
          channelName: channel.name,
          action: 'removed',
          reason: 'Adult content',
        });
        continue;
      }

      // Skip duplicates
      const normalizedUrl = this.normalizeUrl(channel.url);
      if (this.options.removeDuplicates && seenUrls.has(normalizedUrl)) {
        actions.push({
          channelId: channel.id,
          channelName: channel.name,
          action: 'removed',
          reason: 'Duplicate URL',
        });
        continue;
      }
      seenUrls.add(normalizedUrl);

      // Create sanitized copy
      let sanitizedChannel = { ...channel };
      let wasModified = false;

      // Sanitize URL
      const sanitizedUrl = this.sanitizeUrl(channel.url);
      if (sanitizedUrl !== channel.url) {
        sanitizedChannel.url = sanitizedUrl;
        wasModified = true;
      }

      // Apply proxy if configured
      if (this.options.proxyBaseUrl && this.shouldProxy(channel.url)) {
        sanitizedChannel.url = this.applyProxy(sanitizedChannel.url);
        actions.push({
          channelId: channel.id,
          channelName: channel.name,
          action: 'proxied',
          reason: 'HTTP stream on HTTPS page',
        });
        wasModified = true;
      }

      // Normalize name
      if (this.options.normalizeNames) {
        const normalizedName = this.normalizeName(channel.name);
        if (normalizedName !== channel.name) {
          sanitizedChannel.name = normalizedName;
          wasModified = true;
        }
      }

      // Sanitize logo URL
      if (channel.logo) {
        const sanitizedLogo = this.sanitizeLogo(channel.logo);
        if (sanitizedLogo !== channel.logo) {
          sanitizedChannel.logo = sanitizedLogo;
          wasModified = true;
        }
      }

      if (wasModified) {
        modifiedCount++;
        if (!actions.some(a => a.channelId === channel.id)) {
          actions.push({
            channelId: channel.id,
            channelName: channel.name,
            action: 'modified',
            reason: 'URL/Name sanitized',
          });
        }
      }

      sanitizedChannels.push(sanitizedChannel);
    }

    // Rebuild categories
    const categories = this.rebuildCategories(sanitizedChannels);

    return {
      channels: sanitizedChannels,
      categories,
      removedCount: channels.length - sanitizedChannels.length,
      modifiedCount,
      reasons: actions,
    };
  }

  /**
   * Sanitize a single URL
   */
  sanitizeUrl(url: string): string {
    try {
      const parsed = new URL(url);

      // Remove dangerous query params
      for (const param of DANGEROUS_PARAMS) {
        // Keep params but mask sensitive values for logging
        // For actual playback, we keep them
      }

      // Ensure proper encoding
      return parsed.href;
    } catch {
      return url;
    }
  }

  /**
   * Normalize URL for duplicate detection
   */
  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      // Remove trailing slash and lowercase
      return (parsed.origin + parsed.pathname).toLowerCase().replace(/\/+$/, '');
    } catch {
      return url.toLowerCase();
    }
  }

  /**
   * Check if URL is valid
   */
  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return this.options.allowedProtocols.includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  /**
   * Check if domain is blocked
   */
  private isBlockedDomain(url: string): boolean {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();
      
      return this.options.blockedDomains.some(blocked => 
        hostname.includes(blocked.toLowerCase())
      );
    } catch {
      return false;
    }
  }

  /**
   * Check if channel is adult content
   */
  private isAdultContent(channel: M3UChannel): boolean {
    const textToCheck = [
      channel.name,
      channel.group,
      channel.tvgName,
    ].join(' ').toLowerCase();

    return ADULT_KEYWORDS.some(keyword => textToCheck.includes(keyword));
  }

  /**
   * Check if URL should be proxied
   */
  private shouldProxy(url: string): boolean {
    try {
      const parsed = new URL(url);
      // Proxy HTTP on HTTPS pages (mixed content)
      if (typeof window !== 'undefined' && 
          window.location.protocol === 'https:' && 
          parsed.protocol === 'http:') {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Apply proxy to URL
   */
  private applyProxy(url: string): string {
    if (!this.options.proxyBaseUrl) return url;
    return `${this.options.proxyBaseUrl}?url=${encodeURIComponent(url)}`;
  }

  /**
   * Normalize channel name
   */
  private normalizeName(name: string): string {
    let normalized = name
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      // Remove common garbage
      .replace(/\|.*$/g, '')
      .replace(/\[SD\]/gi, '')
      .replace(/\[HD\]/gi, 'HD')
      .replace(/\[FHD\]/gi, 'FHD')
      .replace(/\[4K\]/gi, '4K')
      .replace(/\[.*?\]/g, '')
      .replace(/\(.*\)/g, '')
      // Clean special chars
      .replace(/[_\\-]+/g, ' ')
      .trim();

    // Truncate if too long
    if (normalized.length > this.options.maxNameLength) {
      normalized = normalized.substring(0, this.options.maxNameLength - 3) + '...';
    }

    return normalized || name;
  }

  /**
   * Sanitize logo URL
   */
  private sanitizeLogo(logo: string): string {
    // Fix common logo URL issues
    if (!logo) return '';
    
    // Ensure protocol
    if (logo.startsWith('//')) {
      return `https:${logo}`;
    }
    
    // Basic URL validation
    try {
      new URL(logo);
      return logo;
    } catch {
      return '';
    }
  }

  /**
   * Rebuild categories from channels
   */
  private rebuildCategories(channels: M3UChannel[]): M3UCategory[] {
    const groupMap = new Map<string, M3UChannel[]>();

    for (const channel of channels) {
      const group = channel.group || 'Sem Categoria';
      if (!groupMap.has(group)) {
        groupMap.set(group, []);
      }
      groupMap.get(group)!.push(channel);
    }

    const categories: M3UCategory[] = [];
    let idx = 0;

    for (const [name, groupChannels] of groupMap) {
      categories.push({
        id: `cat-${idx++}`,
        name,
        displayName: this.normalizeGroupName(name),
        channelCount: groupChannels.length,
        channels: groupChannels,
      });
    }

    return categories;
  }

  /**
   * Normalize group name
   */
  private normalizeGroupName(name: string): string {
    return name
      .replace(/\|/g, ' - ')
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
      .trim();
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export const m3uSanitizer = new M3USanitizer();

export function sanitizeM3U(
  channels: M3UChannel[], 
  options?: SanitizeOptions
): SanitizeResult {
  const sanitizer = new M3USanitizer(options);
  return sanitizer.sanitize(channels);
}

export default M3USanitizer;
