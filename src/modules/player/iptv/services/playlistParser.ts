/**
 * M3U/M3U8 Playlist Parser
 * Parses M3U playlists and normalizes to JSON format
 */

import type { IptvChannel, IptvPlaylist } from '../types';

const EXTINF_REGEX = /^#EXTINF:(-?\d+)(?:\s+([^,]*))?,(.*)$/;
const TVG_ID_REGEX = /tvg-id="([^"]*)"/i;
const TVG_NAME_REGEX = /tvg-name="([^"]*)"/i;
const TVG_LOGO_REGEX = /tvg-logo="([^"]*)"/i;
const GROUP_TITLE_REGEX = /group-title="([^"]*)"/i;
const CATCHUP_REGEX = /catchup="([^"]*)"/i;
const CATCHUP_DAYS_REGEX = /catchup-days="(\d+)"/i;

export class PlaylistParser {
  /**
   * Parse M3U content string to IptvPlaylist
   */
  parse(content: string): IptvPlaylist {
    const lines = content.split(/\r?\n/).map(line => line.trim());
    const channels: IptvChannel[] = [];
    const groupsSet = new Set<string>();
    
    let currentChannel: Partial<IptvChannel> = {};
    let isExtM3U = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (!line) continue;
      
      // Check for #EXTM3U header
      if (line.startsWith('#EXTM3U')) {
        isExtM3U = true;
        continue;
      }

      // Skip non-standard comments
      if (line.startsWith('#') && !line.startsWith('#EXTINF') && !line.startsWith('#EXT-X-')) {
        continue;
      }

      // Parse #EXTINF line
      if (line.startsWith('#EXTINF')) {
        const match = line.match(EXTINF_REGEX);
        if (match) {
          const attributes = match[2] || '';
          const name = match[3]?.trim() || 'Unknown';

          currentChannel = {
            id: crypto.randomUUID(),
            name,
            tvgId: this.extractAttribute(attributes, TVG_ID_REGEX),
            tvgName: this.extractAttribute(attributes, TVG_NAME_REGEX),
            logo: this.extractAttribute(attributes, TVG_LOGO_REGEX),
            group: this.extractAttribute(attributes, GROUP_TITLE_REGEX) || 'Uncategorized',
            catchup: this.extractAttribute(attributes, CATCHUP_REGEX),
            catchupDays: parseInt(this.extractAttribute(attributes, CATCHUP_DAYS_REGEX) || '0', 10),
          };

          if (currentChannel.group) {
            groupsSet.add(currentChannel.group);
          }
        }
        continue;
      }

      // Parse URL line (after #EXTINF)
      if (line.startsWith('http') || line.startsWith('rtmp') || line.startsWith('rtsp')) {
        if (currentChannel.name) {
          channels.push({
            ...currentChannel,
            url: line,
          } as IptvChannel);
        }
        currentChannel = {};
        continue;
      }

      // Handle HLS variant streams (#EXT-X-STREAM-INF)
      if (line.startsWith('#EXT-X-STREAM-INF')) {
        // This is an HLS master playlist, treat each variant as a channel
        const nextLine = lines[i + 1];
        if (nextLine && !nextLine.startsWith('#')) {
          const bandwidthMatch = line.match(/BANDWIDTH=(\d+)/);
          const resolutionMatch = line.match(/RESOLUTION=(\d+x\d+)/);
          
          channels.push({
            id: crypto.randomUUID(),
            name: `Quality ${resolutionMatch?.[1] || bandwidthMatch?.[1] || 'Auto'}`,
            url: nextLine,
            group: 'Variants',
          });
          groupsSet.add('Variants');
          i++; // Skip URL line
        }
      }
    }

    return {
      channels,
      groups: Array.from(groupsSet).sort(),
      metadata: {
        lastUpdated: new Date(),
      },
    };
  }

  /**
   * Parse from URL
   */
  async parseFromUrl(url: string, authToken?: string): Promise<IptvPlaylist> {
    const headers: HeadersInit = {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch playlist: ${response.status}`);
    }

    const content = await response.text();
    const playlist = this.parse(content);
    playlist.metadata = {
      ...playlist.metadata,
      url,
    };
    
    return playlist;
  }

  /**
   * Parse JSON playlist format
   */
  parseJson(data: any): IptvPlaylist {
    if (Array.isArray(data)) {
      return this.normalizeChannelArray(data);
    }
    
    if (data.channels) {
      return this.normalizeChannelArray(data.channels);
    }

    throw new Error('Invalid playlist format');
  }

  private normalizeChannelArray(channels: any[]): IptvPlaylist {
    const groupsSet = new Set<string>();
    
    const normalizedChannels: IptvChannel[] = channels.map(ch => {
      const group = ch.group || ch.category || ch.group_title || 'Uncategorized';
      groupsSet.add(group);
      
      return {
        id: ch.id || ch.stream_id || crypto.randomUUID(),
        name: ch.name || ch.title || 'Unknown',
        url: ch.url || ch.stream_url || '',
        logo: ch.logo || ch.stream_icon || ch.tvg_logo || '',
        group,
        tvgId: ch.tvg_id || ch.epg_channel_id || '',
        tvgName: ch.tvg_name || '',
        catchup: ch.catchup || '',
        catchupDays: ch.catchup_days || 0,
      };
    }).filter(ch => ch.url);

    return {
      channels: normalizedChannels,
      groups: Array.from(groupsSet).sort(),
    };
  }

  private extractAttribute(str: string, regex: RegExp): string {
    const match = str.match(regex);
    return match?.[1] || '';
  }
}

export const playlistParser = new PlaylistParser();
