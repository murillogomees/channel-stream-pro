/**
 * XtreamAdapter - Xtream Codes API Adapter
 * 
 * Normalizes Xtream API responses for the player
 * Handles live, VOD, and series content
 */

export interface XtreamCredentials {
  server: string
  username: string
  password: string
}

export interface XtreamChannel {
  id: string
  name: string
  logo: string | null
  stream_url: string
  type: 'live' | 'vod' | 'series'
  category: string | null
  epg_channel_id?: string
}

export interface XtreamCategory {
  id: string
  name: string
  parent_id?: string
}

export interface XtreamEPG {
  id: string
  channel_id: string
  title: string
  description: string
  start: Date
  end: Date
}

export class XtreamAdapter {
  private credentials: XtreamCredentials
  private baseUrl: string

  constructor(credentials: XtreamCredentials) {
    this.credentials = credentials
    this.baseUrl = this.normalizeServerUrl(credentials.server)
  }

  private normalizeServerUrl(server: string): string {
    let url = server.trim()
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'http://' + url
    }
    return url.replace(/\/$/, '')
  }

  /**
   * Get live streams
   */
  async getLiveStreams(categoryId?: string): Promise<XtreamChannel[]> {
    const url = this.buildApiUrl('get_live_streams', categoryId ? { category_id: categoryId } : undefined)
    const data = await this.fetchApi(url)
    
    return data.map((item: Record<string, unknown>) => this.normalizeLiveChannel(item))
  }

  /**
   * Get VOD streams
   */
  async getVodStreams(categoryId?: string): Promise<XtreamChannel[]> {
    const url = this.buildApiUrl('get_vod_streams', categoryId ? { category_id: categoryId } : undefined)
    const data = await this.fetchApi(url)
    
    return data.map((item: Record<string, unknown>) => this.normalizeVodChannel(item))
  }

  /**
   * Get series
   */
  async getSeries(categoryId?: string): Promise<XtreamChannel[]> {
    const url = this.buildApiUrl('get_series', categoryId ? { category_id: categoryId } : undefined)
    const data = await this.fetchApi(url)
    
    return data.map((item: Record<string, unknown>) => this.normalizeSeriesChannel(item))
  }

  /**
   * Get live categories
   */
  async getLiveCategories(): Promise<XtreamCategory[]> {
    const url = this.buildApiUrl('get_live_categories')
    const data = await this.fetchApi(url)
    
    return data.map((item: Record<string, unknown>) => ({
      id: String(item.category_id || ''),
      name: String(item.category_name || 'Sem nome'),
      parent_id: item.parent_id ? String(item.parent_id) : undefined
    }))
  }

  /**
   * Get VOD categories
   */
  async getVodCategories(): Promise<XtreamCategory[]> {
    const url = this.buildApiUrl('get_vod_categories')
    const data = await this.fetchApi(url)
    
    return data.map((item: Record<string, unknown>) => ({
      id: String(item.category_id || ''),
      name: String(item.category_name || 'Sem nome'),
      parent_id: item.parent_id ? String(item.parent_id) : undefined
    }))
  }

  /**
   * Get series categories
   */
  async getSeriesCategories(): Promise<XtreamCategory[]> {
    const url = this.buildApiUrl('get_series_categories')
    const data = await this.fetchApi(url)
    
    return data.map((item: Record<string, unknown>) => ({
      id: String(item.category_id || ''),
      name: String(item.category_name || 'Sem nome'),
      parent_id: item.parent_id ? String(item.parent_id) : undefined
    }))
  }

  /**
   * Get short EPG for a channel
   */
  async getShortEPG(streamId: string): Promise<XtreamEPG[]> {
    const url = this.buildApiUrl('get_short_epg', { stream_id: streamId })
    
    try {
      const response = await this.fetchApiRaw(url)
      const listings = (response as { epg_listings?: Record<string, unknown>[] }).epg_listings || []
      
      return listings.map((item: Record<string, unknown>) => ({
        id: String(item.id || ''),
        channel_id: String(item.channel_id || streamId),
        title: String(item.title || ''),
        description: String(item.description || ''),
        start: new Date((Number(item.start_timestamp) || 0) * 1000),
        end: new Date((Number(item.stop_timestamp) || 0) * 1000)
      }))
    } catch {
      return []
    }
  }

  /**
   * Build stream URL for playback
   */
  buildStreamUrl(streamId: string, type: 'live' | 'vod' | 'series', extension = 'm3u8'): string {
    const { username, password } = this.credentials
    
    switch (type) {
      case 'live':
        return `${this.baseUrl}/live/${username}/${password}/${streamId}.${extension}`
      case 'vod':
        return `${this.baseUrl}/movie/${username}/${password}/${streamId}.${extension}`
      case 'series':
        return `${this.baseUrl}/series/${username}/${password}/${streamId}.${extension}`
      default:
        return `${this.baseUrl}/${username}/${password}/${streamId}`
    }
  }

  // ============ PRIVATE METHODS ============

  private buildApiUrl(action: string, params?: Record<string, string>): string {
    const { username, password } = this.credentials
    let url = `${this.baseUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=${action}`
    
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url += `&${key}=${encodeURIComponent(value)}`
      }
    }
    
    return url
  }

  private async fetchApiRaw(url: string): Promise<unknown> {
    try {
      const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stream-proxy?url=${encodeURIComponent(url)}`
      
      const response = await fetch(proxyUrl, {
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('[XtreamAdapter] Fetch failed:', error)
      throw error
    }
  }

  private async fetchApi(url: string): Promise<Record<string, unknown>[]> {
    try {
      // Use stream-proxy to avoid CORS and hide credentials
      const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stream-proxy?url=${encodeURIComponent(url)}`
      
      const response = await fetch(proxyUrl, {
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()
      return Array.isArray(data) ? data : []
    } catch (error) {
      console.error('[XtreamAdapter] Fetch failed:', error)
      throw error
    }
  }

  private normalizeLiveChannel(item: Record<string, unknown>): XtreamChannel {
    const streamId = String(item.stream_id || item.id || '')
    
    return {
      id: streamId,
      name: String(item.name || 'Sem nome'),
      logo: item.stream_icon ? String(item.stream_icon) : null,
      stream_url: this.buildStreamUrl(streamId, 'live'),
      type: 'live',
      category: item.category_name ? String(item.category_name) : null,
      epg_channel_id: item.epg_channel_id ? String(item.epg_channel_id) : undefined
    }
  }

  private normalizeVodChannel(item: Record<string, unknown>): XtreamChannel {
    const streamId = String(item.stream_id || item.id || '')
    const extension = item.container_extension ? String(item.container_extension) : 'mp4'
    
    return {
      id: streamId,
      name: String(item.name || 'Sem nome'),
      logo: item.stream_icon ? String(item.stream_icon) : null,
      stream_url: this.buildStreamUrl(streamId, 'vod', extension),
      type: 'vod',
      category: item.category_name ? String(item.category_name) : null
    }
  }

  private normalizeSeriesChannel(item: Record<string, unknown>): XtreamChannel {
    const seriesId = String(item.series_id || item.id || '')
    
    return {
      id: seriesId,
      name: String(item.name || 'Sem nome'),
      logo: item.cover ? String(item.cover) : null,
      stream_url: '', // Series need episode selection
      type: 'series',
      category: item.category_name ? String(item.category_name) : null
    }
  }
}

export default XtreamAdapter
