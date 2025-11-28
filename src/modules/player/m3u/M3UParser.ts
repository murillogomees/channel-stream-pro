/**
 * ============================================================================
 * M3U Parser Enterprise - Parser Resiliente e Robusto
 * ============================================================================
 * 
 * Parser de arquivos M3U/M3U8 com suporte a:
 * - EXTINF tags completas
 * - Grupos/Categorias
 * - TVG attributes (logo, id, name)
 * - Metadata customizado
 * - Limpeza automática de streams inválidos
 * 
 * @version 3.0.0
 */

// =============================================================================
// TYPES
// =============================================================================

export interface M3UChannel {
  id: string;
  name: string;
  url: string;
  group: string;
  logo: string;
  tvgId: string;
  tvgName: string;
  duration: number;
  metadata: Record<string, string>;
  isValid: boolean;
  validationErrors: string[];
}

export interface M3UCategory {
  id: string;
  name: string;
  displayName: string;
  channelCount: number;
  channels: M3UChannel[];
  icon?: string;
}

export interface M3UParseResult {
  channels: M3UChannel[];
  categories: M3UCategory[];
  totalChannels: number;
  validChannels: number;
  invalidChannels: number;
  parseTime: number;
  errors: string[];
}

export interface M3UParseOptions {
  validateUrls?: boolean;
  removeInvalid?: boolean;
  maxChannels?: number;
  defaultGroup?: string;
  normalizeNames?: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const EXTINF_REGEX = /^#EXTINF:\s*(-?\d*\.?\d*)\s*(?:,(.*))?$/;
const TVG_ATTRIBUTE_REGEX = /(\w+[-\w]*)="([^"]*)"/g;
const VALID_URL_PROTOCOLS = ['http:', 'https:', 'rtmp:', 'rtsp:', 'mms:'];
const DEFAULT_GROUP = 'Sem Categoria';

// =============================================================================
// M3U PARSER CLASS
// =============================================================================

export class M3UParser {
  private options: Required<M3UParseOptions>;

  constructor(options: M3UParseOptions = {}) {
    this.options = {
      validateUrls: options.validateUrls ?? true,
      removeInvalid: options.removeInvalid ?? false,
      maxChannels: options.maxChannels ?? Infinity,
      defaultGroup: options.defaultGroup ?? DEFAULT_GROUP,
      normalizeNames: options.normalizeNames ?? true,
    };
  }

  /**
   * Parse M3U content string
   */
  parse(content: string): M3UParseResult {
    const startTime = performance.now();
    const errors: string[] = [];
    const channels: M3UChannel[] = [];

    // Normalize line endings
    const lines = content
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    // Check header
    if (!lines[0]?.toUpperCase().startsWith('#EXTM3U')) {
      errors.push('Invalid M3U header - missing #EXTM3U');
    }

    let currentExtinf: string | null = null;
    let channelIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip header
      if (line.toUpperCase().startsWith('#EXTM3U')) {
        continue;
      }

      // EXTINF line
      if (line.startsWith('#EXTINF:')) {
        currentExtinf = line;
        continue;
      }

      // Skip other comments/directives
      if (line.startsWith('#')) {
        continue;
      }

      // URL line - parse channel
      if (currentExtinf && this.isValidUrl(line)) {
        if (channelIndex >= this.options.maxChannels) {
          break;
        }

        const channel = this.parseChannel(currentExtinf, line, channelIndex);
        
        if (this.options.validateUrls) {
          this.validateChannel(channel);
        }

        if (!this.options.removeInvalid || channel.isValid) {
          channels.push(channel);
          channelIndex++;
        }

        currentExtinf = null;
      }
    }

    // Group channels into categories
    const categories = this.groupByCategory(channels);

    const parseTime = performance.now() - startTime;
    const validChannels = channels.filter(c => c.isValid).length;

    return {
      channels,
      categories,
      totalChannels: channels.length,
      validChannels,
      invalidChannels: channels.length - validChannels,
      parseTime,
      errors,
    };
  }

  /**
   * Parse a single channel from EXTINF line and URL
   */
  private parseChannel(extinfLine: string, url: string, index: number): M3UChannel {
    const metadata: Record<string, string> = {};
    const validationErrors: string[] = [];

    // Extract duration and title
    const extinfMatch = extinfLine.match(EXTINF_REGEX);
    const duration = extinfMatch ? parseFloat(extinfMatch[1]) || -1 : -1;
    let title = extinfMatch?.[2] || '';

    // Extract TVG attributes
    let tvgId = '';
    let tvgName = '';
    let tvgLogo = '';
    let group = this.options.defaultGroup;

    const attributePart = extinfLine.substring(extinfLine.indexOf(':') + 1);
    let match;

    while ((match = TVG_ATTRIBUTE_REGEX.exec(attributePart)) !== null) {
      const [, key, value] = match;
      const keyLower = key.toLowerCase();

      switch (keyLower) {
        case 'tvg-id':
          tvgId = value;
          break;
        case 'tvg-name':
          tvgName = value;
          break;
        case 'tvg-logo':
        case 'logo':
          tvgLogo = value;
          break;
        case 'group-title':
          group = value || this.options.defaultGroup;
          break;
        default:
          metadata[key] = value;
      }
    }

    // Extract title from after comma if attributes present
    const commaIndex = attributePart.lastIndexOf(',');
    if (commaIndex !== -1) {
      title = attributePart.substring(commaIndex + 1).trim();
    }

    // Normalize name
    let name = tvgName || title || `Canal ${index + 1}`;
    if (this.options.normalizeNames) {
      name = this.normalizeName(name);
    }

    // Generate ID
    const id = this.generateChannelId(name, url, index);

    return {
      id,
      name,
      url,
      group,
      logo: tvgLogo,
      tvgId,
      tvgName,
      duration,
      metadata,
      isValid: true,
      validationErrors,
    };
  }

  /**
   * Validate channel URL and properties
   */
  private validateChannel(channel: M3UChannel): void {
    const errors: string[] = [];

    // URL validation
    if (!channel.url) {
      errors.push('Missing URL');
    } else if (!this.isValidUrl(channel.url)) {
      errors.push('Invalid URL format');
    } else {
      try {
        const parsed = new URL(channel.url);
        if (!VALID_URL_PROTOCOLS.includes(parsed.protocol)) {
          errors.push(`Unsupported protocol: ${parsed.protocol}`);
        }
      } catch {
        errors.push('URL parse error');
      }
    }

    // Name validation
    if (!channel.name || channel.name.length < 1) {
      errors.push('Missing or invalid name');
    }

    channel.validationErrors = errors;
    channel.isValid = errors.length === 0;
  }

  /**
   * Group channels into categories
   */
  private groupByCategory(channels: M3UChannel[]): M3UCategory[] {
    const groupMap = new Map<string, M3UChannel[]>();

    for (const channel of channels) {
      const group = channel.group || this.options.defaultGroup;
      if (!groupMap.has(group)) {
        groupMap.set(group, []);
      }
      groupMap.get(group)!.push(channel);
    }

    const categories: M3UCategory[] = [];
    let categoryIndex = 0;

    for (const [name, groupChannels] of groupMap) {
      categories.push({
        id: `category-${categoryIndex++}`,
        name,
        displayName: this.normalizeGroupName(name),
        channelCount: groupChannels.length,
        channels: groupChannels,
        icon: this.getCategoryIcon(name),
      });
    }

    // Sort: prioritize common categories
    return categories.sort((a, b) => {
      const priority = ['TV', 'FILMES', 'SERIES', 'ESPORTES', 'DOCUMENTARIOS', 'INFANTIL'];
      const aIndex = priority.findIndex(p => a.name.toUpperCase().includes(p));
      const bIndex = priority.findIndex(p => b.name.toUpperCase().includes(p));
      
      if (aIndex !== -1 && bIndex === -1) return -1;
      if (aIndex === -1 && bIndex !== -1) return 1;
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Check if string is a valid URL
   */
  private isValidUrl(str: string): boolean {
    try {
      const url = new URL(str);
      return VALID_URL_PROTOCOLS.includes(url.protocol);
    } catch {
      return false;
    }
  }

  /**
   * Generate unique channel ID
   */
  private generateChannelId(name: string, url: string, index: number): string {
    const nameSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 30);
    
    // Simple hash of URL
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      hash = ((hash << 5) - hash + url.charCodeAt(i)) | 0;
    }
    
    return `ch-${nameSlug}-${Math.abs(hash).toString(36)}-${index}`;
  }

  /**
   * Normalize channel name
   */
  private normalizeName(name: string): string {
    return name
      .replace(/\s+/g, ' ')
      .replace(/\|.*$/, '')
      .replace(/\[.*?\]/g, '')
      .replace(/\(.*?\)/g, '')
      .trim();
  }

  /**
   * Normalize group name for display
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

  /**
   * Get icon for category based on name
   */
  private getCategoryIcon(name: string): string | undefined {
    const nameLower = name.toLowerCase();
    
    if (nameLower.includes('filme') || nameLower.includes('movie')) return '🎬';
    if (nameLower.includes('serie') || nameLower.includes('series')) return '📺';
    if (nameLower.includes('esporte') || nameLower.includes('sport')) return '⚽';
    if (nameLower.includes('noticia') || nameLower.includes('news')) return '📰';
    if (nameLower.includes('document')) return '📚';
    if (nameLower.includes('infantil') || nameLower.includes('kids')) return '🧸';
    if (nameLower.includes('musica') || nameLower.includes('music')) return '🎵';
    if (nameLower.includes('adulto') || nameLower.includes('adult') || nameLower.includes('xxx')) return '🔞';
    
    return undefined;
  }
}

// =============================================================================
// SINGLETON & EXPORTS
// =============================================================================

export const m3uParser = new M3UParser();

export function parseM3U(content: string, options?: M3UParseOptions): M3UParseResult {
  const parser = new M3UParser(options);
  return parser.parse(content);
}

export default M3UParser;
