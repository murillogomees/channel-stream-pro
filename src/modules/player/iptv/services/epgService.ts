/**
 * EPG (Electronic Program Guide) Service
 * Handles XMLTV/JTV and JSON EPG formats
 */

import type { EpgProgram, EpgData } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';

export class EpgService {
  private cache: Map<string, EpgData> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private cacheTTL = 3600000; // 1 hour

  /**
   * Load EPG data for a channel
   */
  async loadEpg(channelId: string, epgUrl?: string): Promise<EpgProgram[]> {
    // Check cache first
    const cached = this.getFromCache(channelId);
    if (cached) {
      return cached;
    }

    try {
      // Try API endpoint first
      const apiData = await this.loadFromApi(channelId);
      if (apiData.length > 0) {
        this.setCache(channelId, apiData);
        return apiData;
      }

      // Fall back to direct URL if provided
      if (epgUrl) {
        const urlData = await this.loadFromUrl(epgUrl, channelId);
        this.setCache(channelId, urlData);
        return urlData;
      }

      return [];
    } catch (error) {
      console.error('[EPG Service] Error loading EPG:', error);
      return [];
    }
  }

  /**
   * Load EPG from API endpoint
   */
  private async loadFromApi(channelId: string): Promise<EpgProgram[]> {
    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/iptv-epg?channelId=${channelId}`
      );
      
      if (!response.ok) return [];
      
      const data = await response.json();
      return this.normalizePrograms(data.programs || data, channelId);
    } catch {
      return [];
    }
  }

  /**
   * Load EPG from URL (XMLTV or JSON)
   */
  private async loadFromUrl(url: string, channelId: string): Promise<EpgProgram[]> {
    const response = await fetch(url);
    if (!response.ok) return [];

    const contentType = response.headers.get('content-type') || '';
    const content = await response.text();

    if (contentType.includes('json') || content.trim().startsWith('{') || content.trim().startsWith('[')) {
      return this.parseJsonEpg(content, channelId);
    }

    return this.parseXmltvEpg(content, channelId);
  }

  /**
   * Parse JSON EPG format
   */
  private parseJsonEpg(content: string, channelId: string): EpgProgram[] {
    try {
      const data = JSON.parse(content);
      const programs = Array.isArray(data) ? data : data.programs || data.epg || [];
      return this.normalizePrograms(programs, channelId);
    } catch {
      return [];
    }
  }

  /**
   * Parse XMLTV format
   */
  private parseXmltvEpg(content: string, targetChannelId: string): EpgProgram[] {
    const programs: EpgProgram[] = [];
    
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'text/xml');
      
      const programElements = doc.querySelectorAll('programme');
      
      programElements.forEach(prog => {
        const channelAttr = prog.getAttribute('channel');
        
        // Filter by channel if specified
        if (targetChannelId && channelAttr !== targetChannelId) {
          return;
        }

        const startStr = prog.getAttribute('start');
        const stopStr = prog.getAttribute('stop');
        
        if (!startStr || !stopStr) return;

        const title = prog.querySelector('title')?.textContent || 'Unknown';
        const desc = prog.querySelector('desc')?.textContent || '';
        const category = prog.querySelector('category')?.textContent || '';
        const icon = prog.querySelector('icon')?.getAttribute('src') || '';

        programs.push({
          id: crypto.randomUUID(),
          channelId: channelAttr || targetChannelId,
          title,
          description: desc,
          start: this.parseXmltvDate(startStr),
          end: this.parseXmltvDate(stopStr),
          category,
          icon,
        });
      });
    } catch (error) {
      console.error('[EPG Service] XMLTV parse error:', error);
    }

    return programs.sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  /**
   * Parse XMLTV date format (YYYYMMDDHHMMSS +HHMM)
   */
  private parseXmltvDate(dateStr: string): Date {
    const match = dateStr.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?$/);
    
    if (!match) {
      return new Date(dateStr);
    }

    const [, year, month, day, hour, minute, second, tz] = match;
    let date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
    
    if (tz) {
      const tzOffset = parseInt(tz.substring(0, 3)) * 60 + parseInt(tz.substring(3));
      date = new Date(date.getTime() - tzOffset * 60000);
    }

    return date;
  }

  /**
   * Normalize programs to standard format
   */
  private normalizePrograms(programs: any[], channelId: string): EpgProgram[] {
    return programs.map(prog => ({
      id: prog.id || crypto.randomUUID(),
      channelId: prog.channel_id || prog.channelId || channelId,
      title: prog.title || prog.name || 'Unknown',
      description: prog.description || prog.desc || prog.plot || '',
      start: new Date(prog.start || prog.start_timestamp * 1000),
      end: new Date(prog.end || prog.stop || prog.stop_timestamp * 1000),
      category: prog.category || prog.genre || '',
      icon: prog.icon || prog.image || '',
    })).filter(p => !isNaN(p.start.getTime()) && !isNaN(p.end.getTime()));
  }

  /**
   * Get current program for channel
   */
  getCurrentProgram(channelId: string): EpgProgram | null {
    const programs = this.getFromCache(channelId);
    if (!programs) return null;

    const now = Date.now();
    return programs.find(p => 
      p.start.getTime() <= now && p.end.getTime() > now
    ) || null;
  }

  /**
   * Get upcoming programs for channel
   */
  getUpcomingPrograms(channelId: string, limit = 5): EpgProgram[] {
    const programs = this.getFromCache(channelId);
    if (!programs) return [];

    const now = Date.now();
    return programs
      .filter(p => p.end.getTime() > now)
      .slice(0, limit);
  }

  /**
   * Cache helpers
   */
  private getFromCache(channelId: string): EpgProgram[] | null {
    const expiry = this.cacheExpiry.get(channelId);
    if (!expiry || Date.now() > expiry) {
      this.cache.delete(channelId);
      this.cacheExpiry.delete(channelId);
      return null;
    }
    
    const data = this.cache.get(channelId);
    return data?.programs.filter(p => p.channelId === channelId) || null;
  }

  private setCache(channelId: string, programs: EpgProgram[]) {
    const existing = this.cache.get('all') || { programs: [], channels: new Map() };
    const filteredPrograms = existing.programs.filter(p => p.channelId !== channelId);
    
    this.cache.set('all', {
      programs: [...filteredPrograms, ...programs],
      channels: existing.channels,
    });
    this.cache.set(channelId, { programs, channels: new Map() });
    this.cacheExpiry.set(channelId, Date.now() + this.cacheTTL);
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    this.cacheExpiry.clear();
  }
}

export const epgService = new EpgService();
