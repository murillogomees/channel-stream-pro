/**
 * ShakaPlayerEngine - Enterprise-grade player engine using Shaka Player
 * 
 * Features:
 * - HLS/DASH support
 * - Custom headers injection
 * - Auto-recovery from 403/token expiry
 * - Xtream-ready configuration
 */

import shaka from 'shaka-player'

export type PlayerState = 'idle' | 'loading' | 'buffering' | 'playing' | 'paused' | 'error'

export interface ShakaEngineConfig {
  onStateChange?: (state: PlayerState) => void
  onError?: (error: Error, isFatal: boolean) => void
  onTokenExpired?: () => Promise<string>
  onMetrics?: (metrics: EngineMetrics) => void
}

export interface EngineMetrics {
  bufferLevel: number
  bandwidth: number
  droppedFrames: number
  loadLatency: number
}

export class ShakaPlayerEngine {
  private player: shaka.Player | null = null
  private video: HTMLVideoElement | null = null
  private config: ShakaEngineConfig
  private currentUrl: string = ''
  private streamToken: string = ''
  private state: PlayerState = 'idle'
  private retryCount = 0
  private maxRetries = 3
  private sessionId: string

  constructor(config: ShakaEngineConfig = {}) {
    this.config = config
    this.sessionId = `shaka_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    
    // Install polyfills
    shaka.polyfill.installAll()
    
    console.log('[ShakaEngine] Initialized')
  }

  /**
   * Attach to video element and load source
   */
  async attach(video: HTMLVideoElement, url: string, token?: string): Promise<void> {
    this.video = video
    this.currentUrl = url
    if (token) this.streamToken = token

    // Destroy existing player
    if (this.player) {
      await this.player.destroy()
    }

    // Check browser support
    if (!shaka.Player.isBrowserSupported()) {
      console.error('[ShakaEngine] Browser not supported')
      this.setState('error')
      this.config.onError?.(new Error('Browser não suportado'), true)
      return
    }

    this.setState('loading')

    try {
      // Create player
      this.player = new shaka.Player()
      await this.player.attach(video)

      // Configure player
      this.configurePlayer()

      // Setup event listeners
      this.setupEventListeners()

      // Load manifest
      await this.loadManifest(url)
    } catch (err) {
      console.error('[ShakaEngine] Attach failed:', err)
      this.handleError(err as Error)
    }
  }

  /**
   * Configure Shaka for IPTV/Xtream streams
   */
  private configurePlayer(): void {
    if (!this.player) return

    this.player.configure({
      streaming: {
        bufferingGoal: 30,
        rebufferingGoal: 2,
        bufferBehind: 90,
        retryParameters: {
          maxAttempts: 5,
          baseDelay: 500,
          backoffFactor: 2,
          fuzzFactor: 0.5,
          timeout: 30000
        },
        failureCallback: (error) => {
          console.warn('[ShakaEngine] Streaming failure:', error.code)
        }
      },
      manifest: {
        retryParameters: {
          maxAttempts: 5,
          baseDelay: 1000,
          backoffFactor: 2,
          fuzzFactor: 0.5,
          timeout: 30000
        }
      },
      drm: {
        retryParameters: {
          maxAttempts: 3,
          baseDelay: 500,
          backoffFactor: 2,
          fuzzFactor: 0.5,
          timeout: 10000
        }
      }
    })

    // Configure network filters for custom headers
    this.player.getNetworkingEngine()?.registerRequestFilter((type, request) => {
      // Add custom headers for all requests
      request.headers['x-session-id'] = this.sessionId
      request.headers['User-Agent'] = 'ShakaIPTV/1.0'
      
      if (this.streamToken) {
        request.headers['x-stream-token'] = this.streamToken
      }

      // Log for debugging
      console.debug('[ShakaEngine] Request:', type, request.uris[0]?.substring(0, 100))
    })

    // Response filter for error detection
    this.player.getNetworkingEngine()?.registerResponseFilter((type, response) => {
      // Check for auth errors in response
      if (response.status === 401 || response.status === 403) {
        console.warn('[ShakaEngine] Auth error in response:', response.status)
      }
    })
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    if (!this.player || !this.video) return

    // Player events
    this.player.addEventListener('error', (event) => {
      const error = (event as unknown as { detail: shaka.util.Error }).detail
      this.handleShakaError(error)
    })

    this.player.addEventListener('buffering', (event) => {
      const buffering = (event as unknown as { buffering: boolean }).buffering
      if (buffering) {
        this.setState('buffering')
      } else if (this.video?.paused === false) {
        this.setState('playing')
      }
    })

    this.player.addEventListener('loading', () => {
      this.setState('loading')
    })

    // Video events
    this.video.addEventListener('playing', () => {
      this.setState('playing')
      this.retryCount = 0 // Reset on successful playback
    })

    this.video.addEventListener('pause', () => {
      if (this.state !== 'error') {
        this.setState('paused')
      }
    })

    this.video.addEventListener('waiting', () => {
      this.setState('buffering')
    })

    this.video.addEventListener('ended', () => {
      this.setState('paused')
    })
  }

  /**
   * Check if URL is a direct media file (not HLS/DASH manifest)
   */
  private isDirectMediaFile(url: string): boolean {
    const urlLower = url.toLowerCase()
    return urlLower.endsWith('.mp4') || 
           urlLower.endsWith('.mkv') ||
           urlLower.endsWith('.avi') ||
           urlLower.endsWith('.webm') ||
           urlLower.endsWith('.mov') ||
           urlLower.includes('.mp4?') ||
           urlLower.includes('/movie/') ||
           urlLower.includes('/series/')
  }

  /**
   * Load manifest with proxy wrapping
   */
  private async loadManifest(url: string): Promise<void> {
    if (!this.player || !this.video) return

    // Build proxied URL
    const proxyBase = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stream-proxy`
    const proxiedUrl = `${proxyBase}?url=${encodeURIComponent(url)}`

    console.log('[ShakaEngine] Loading:', proxiedUrl.substring(0, 100))

    // Check if this is a direct media file (MP4, etc) - use native playback
    if (this.isDirectMediaFile(url)) {
      console.log('[ShakaEngine] Direct media file detected, using native playback')
      return this.loadDirectMedia(proxiedUrl)
    }

    try {
      await this.player.load(proxiedUrl)
      
      // Auto-play
      if (this.video) {
        await this.video.play()
      }

      console.log('[ShakaEngine] Loaded successfully')
      this.reportMetrics()
    } catch (err) {
      throw err
    }
  }

  /**
   * Load direct media file (MP4, etc) using native HTML5 video
   */
  private async loadDirectMedia(proxiedUrl: string): Promise<void> {
    if (!this.video) return

    // Detach Shaka from video element for native playback
    if (this.player) {
      await this.player.detach()
    }

    return new Promise((resolve, reject) => {
      const video = this.video!

      const onCanPlay = () => {
        console.log('[ShakaEngine] Direct media can play')
        video.removeEventListener('canplay', onCanPlay)
        video.removeEventListener('error', onError)
        this.setState('playing')
        video.play().catch(console.error)
        resolve()
      }

      const onError = () => {
        video.removeEventListener('canplay', onCanPlay)
        video.removeEventListener('error', onError)
        const mediaError = video.error
        console.error('[ShakaEngine] Direct media error:', mediaError?.message)
        reject(new Error(mediaError?.message || 'Erro ao carregar mídia'))
      }

      video.addEventListener('canplay', onCanPlay)
      video.addEventListener('error', onError)

      // Set source directly
      video.src = proxiedUrl
      video.load()
    })
  }

  /**
   * Handle Shaka-specific errors
   */
  private handleShakaError(error: shaka.util.Error): void {
    console.error('[ShakaEngine] Shaka error:', error.code, error.message)

    // Classify error type
    const isAuthError = error.code === shaka.util.Error.Code.BAD_HTTP_STATUS && 
      (error.data?.[1] === 401 || error.data?.[1] === 403)

    const isNetworkError = [
      shaka.util.Error.Code.HTTP_ERROR,
      shaka.util.Error.Code.TIMEOUT,
      shaka.util.Error.Code.BAD_HTTP_STATUS
    ].includes(error.code)

    if (isAuthError) {
      this.handleAuthError()
    } else if (isNetworkError && this.retryCount < this.maxRetries) {
      this.handleNetworkError()
    } else {
      this.setState('error')
      this.config.onError?.(new Error(this.getErrorMessage(error)), error.severity === shaka.util.Error.Severity.CRITICAL)
    }
  }

  /**
   * Handle auth/token errors - refresh and retry
   */
  private async handleAuthError(): Promise<void> {
    console.log('[ShakaEngine] Handling auth error, refreshing token...')

    if (this.config.onTokenExpired) {
      try {
        this.streamToken = await this.config.onTokenExpired()
        console.log('[ShakaEngine] Token refreshed, reloading...')
        await this.reload()
      } catch (err) {
        console.error('[ShakaEngine] Token refresh failed:', err)
        this.setState('error')
        this.config.onError?.(new Error('Sessão expirada'), true)
      }
    } else {
      this.setState('error')
      this.config.onError?.(new Error('Autenticação falhou'), true)
    }
  }

  /**
   * Handle network errors with exponential backoff
   */
  private async handleNetworkError(): Promise<void> {
    this.retryCount++
    const delay = Math.min(1000 * Math.pow(2, this.retryCount - 1), 10000)

    console.log(`[ShakaEngine] Network error, retry ${this.retryCount}/${this.maxRetries} in ${delay}ms`)

    await new Promise(resolve => setTimeout(resolve, delay))
    await this.reload()
  }

  /**
   * Get user-friendly error message
   */
  private getErrorMessage(error: shaka.util.Error): string {
    switch (error.code) {
      case shaka.util.Error.Code.BAD_HTTP_STATUS:
        return 'Erro de conexão com o servidor'
      case shaka.util.Error.Code.HTTP_ERROR:
        return 'Falha na conexão de rede'
      case shaka.util.Error.Code.TIMEOUT:
        return 'Tempo limite excedido'
      case shaka.util.Error.Code.UNABLE_TO_GUESS_MANIFEST_TYPE:
        return 'Formato de stream não suportado'
      default:
        return 'Erro ao reproduzir vídeo'
    }
  }

  /**
   * Handle generic errors
   */
  private handleError(error: Error): void {
    console.error('[ShakaEngine] Error:', error)
    this.setState('error')
    this.config.onError?.(error, true)
  }

  /**
   * Update and notify state
   */
  private setState(newState: PlayerState): void {
    if (this.state !== newState) {
      this.state = newState
      this.config.onStateChange?.(newState)
    }
  }

  /**
   * Report metrics
   */
  private reportMetrics(): void {
    if (!this.player || !this.video) return

    const stats = this.player.getStats()
    
    this.config.onMetrics?.({
      bufferLevel: this.video.buffered.length > 0 
        ? this.video.buffered.end(0) - this.video.currentTime 
        : 0,
      bandwidth: stats.estimatedBandwidth || 0,
      droppedFrames: stats.droppedFrames || 0,
      loadLatency: stats.loadLatency || 0
    })
  }

  // ============ PUBLIC METHODS ============

  play(): void {
    this.video?.play()
  }

  pause(): void {
    this.video?.pause()
  }

  seek(time: number): void {
    if (this.video) {
      this.video.currentTime = time
    }
  }

  setVolume(volume: number): void {
    if (this.video) {
      this.video.volume = Math.max(0, Math.min(1, volume))
    }
  }

  async reload(): Promise<void> {
    if (this.currentUrl && this.video) {
      await this.attach(this.video, this.currentUrl, this.streamToken)
    }
  }

  async destroy(): Promise<void> {
    if (this.player) {
      await this.player.destroy()
      this.player = null
    }
    this.video = null
    this.setState('idle')
    console.log('[ShakaEngine] Destroyed')
  }

  getState(): PlayerState {
    return this.state
  }

  getPlayer(): shaka.Player | null {
    return this.player
  }

  setToken(token: string): void {
    this.streamToken = token
  }

  getVariantTracks(): shaka.extern.Track[] {
    return this.player?.getVariantTracks() || []
  }

  selectVariantTrack(track: shaka.extern.Track): void {
    this.player?.selectVariantTrack(track, true)
  }
}

export default ShakaPlayerEngine
