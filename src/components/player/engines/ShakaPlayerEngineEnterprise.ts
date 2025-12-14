/**
 * ShakaPlayerEngineEnterprise - Enterprise IPTV Player Engine
 * 
 * Configurações para MÍNIMO EGRESS:
 * - Buffer otimizado (live: 15s, VOD: 30s)
 * - Retry limitado (max 2)
 * - Segment prefetch = 1
 * - Low latency mode
 * - Abort em idle
 * - Token refresh automático
 * - Stream group selection
 */

import shaka from 'shaka-player'

export type PlayerState = 'idle' | 'loading' | 'buffering' | 'playing' | 'paused' | 'reconnecting' | 'error'

export interface EnterpriseEngineConfig {
  onStateChange?: (state: PlayerState) => void
  onError?: (error: PlayerError, isFatal: boolean) => void
  onTokenExpired?: () => Promise<string>
  onMetrics?: (metrics: EngineMetrics) => void
  onReconnecting?: (attempt: number) => void
  isLive?: boolean
}

export interface PlayerError {
  code: string
  message: string
  recoverable: boolean
}

export interface EngineMetrics {
  bufferLevel: number
  bandwidth: number
  droppedFrames: number
  loadLatency: number
  egressBytes: number
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export class ShakaPlayerEngineEnterprise {
  private player: shaka.Player | null = null
  private video: HTMLVideoElement | null = null
  private currentUrl: string = ''
  private streamToken: string = ''
  private state: PlayerState = 'idle'
  private retryCount = 0
  private maxRetries = 2 // Mínimo retry
  private sessionId: string
  private config: EnterpriseEngineConfig
  private isLive: boolean
  private egressBytes = 0
  private destroyed = false
  private idleTimeout: number | null = null
  private visibilityHandler: (() => void) | null = null

  constructor(config: EnterpriseEngineConfig = {}) {
    this.config = config
    this.isLive = config.isLive ?? true
    this.sessionId = `shaka_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    
    shaka.polyfill.installAll()
    
    // Setup visibility handler for idle abort
    this.visibilityHandler = this.handleVisibilityChange.bind(this)
    document.addEventListener('visibilitychange', this.visibilityHandler)
    
    console.log('[ShakaEnterprise] Initialized - Mode:', this.isLive ? 'LIVE' : 'VOD')
  }

  /**
   * Attach to video element and load source
   */
  async attach(video: HTMLVideoElement, url: string, token?: string): Promise<void> {
    this.destroyed = false
    this.video = video
    this.currentUrl = url
    if (token) this.streamToken = token

    // Destroy existing player
    if (this.player) {
      await this.player.destroy()
    }

    if (!shaka.Player.isBrowserSupported()) {
      console.error('[ShakaEnterprise] Browser not supported')
      this.setState('error')
      this.emitError('NOT_SUPPORTED', 'Navegador não suportado', false)
      return
    }

    this.setState('loading')

    try {
      // Create player
      this.player = new shaka.Player()
      await this.player.attach(video)

      // Configure with LOW EGRESS settings
      this.configurePlayer()

      // Setup event listeners
      this.setupEventListeners()

      // Warm-up manifest check (HEAD request)
      const isValid = await this.warmUpManifest(url)
      if (!isValid) {
        throw new Error('Manifest validation failed')
      }

      // Load manifest
      await this.loadManifest(url)
    } catch (err) {
      console.error('[ShakaEnterprise] Attach failed:', err)
      this.handleError(err as Error)
    }
  }

  /**
   * Configure Shaka for MINIMUM EGRESS
   */
  private configurePlayer(): void {
    if (!this.player) return

    // Buffer goals based on content type
    const bufferingGoal = this.isLive ? 15 : 30
    const rebufferingGoal = this.isLive ? 5 : 2
    const bufferBehind = this.isLive ? 30 : 60

    this.player.configure({
      streaming: {
        bufferingGoal,
        rebufferingGoal,
        bufferBehind,
        // CRITICAL: Limit retries for low egress
        retryParameters: {
          maxAttempts: 2,
          baseDelay: 500,
          backoffFactor: 1.2,
          fuzzFactor: 0.1,
          timeout: 15000
        },
        // CRITICAL: Limit prefetch
        segmentPrefetchLimit: 1,
        // Low latency for live
        lowLatencyMode: this.isLive,
        // Failure callback
        failureCallback: (error) => {
          console.warn('[ShakaEnterprise] Streaming failure:', error.code)
        }
      },
      manifest: {
        retryParameters: {
          maxAttempts: 2,
          baseDelay: 500,
          backoffFactor: 1.5,
          fuzzFactor: 0.1,
          timeout: 10000
        }
      },
      abr: {
        enabled: true,
        defaultBandwidthEstimate: 1000000, // Start conservative
        switchInterval: 4,
        bandwidthUpgradeTarget: 0.85,
        bandwidthDowngradeTarget: 0.95
      }
    })

    // Configure network filters for custom headers and egress tracking
    const networkEngine = this.player.getNetworkingEngine()
    
    networkEngine?.registerRequestFilter((type, request) => {
      request.headers['x-session-id'] = this.sessionId
      request.headers['User-Agent'] = 'VLC/3.0.18'
      
      if (this.streamToken) {
        request.headers['x-stream-token'] = this.streamToken
      }
    })

    // Track egress
    networkEngine?.registerResponseFilter((type, response) => {
      if (response.data) {
        this.egressBytes += response.data.byteLength
      }
    })
  }

  /**
   * Warm-up: validate manifest before loading (HEAD request - no egress)
   */
  private async warmUpManifest(url: string): Promise<boolean> {
    const proxyBase = `${SUPABASE_URL}/functions/v1/stream-proxy`
    const proxiedUrl = `${proxyBase}?url=${encodeURIComponent(url)}`

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(proxiedUrl, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'x-session-id': this.sessionId,
          ...(this.streamToken && { 'x-stream-token': this.streamToken })
        }
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        console.warn('[ShakaEnterprise] Warm-up failed:', response.status)
        return false
      }

      console.log('[ShakaEnterprise] Warm-up OK')
      return true
    } catch (err) {
      console.warn('[ShakaEnterprise] Warm-up error:', err)
      return false
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    if (!this.player || !this.video) return

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

    // Video events
    this.video.addEventListener('playing', () => {
      this.setState('playing')
      this.retryCount = 0
      this.clearIdleTimeout()
    })

    this.video.addEventListener('pause', () => {
      if (this.state !== 'error' && this.state !== 'reconnecting') {
        this.setState('paused')
        // Start idle timeout when paused
        this.startIdleTimeout()
      }
    })

    this.video.addEventListener('waiting', () => {
      this.setState('buffering')
    })
  }

  /**
   * Check if URL is a direct media file
   */
  private isDirectMediaFile(url: string): boolean {
    const urlLower = url.toLowerCase()
    return urlLower.endsWith('.mp4') || 
           urlLower.endsWith('.mkv') ||
           urlLower.endsWith('.avi') ||
           urlLower.endsWith('.webm') ||
           urlLower.endsWith('.mov') ||
           urlLower.includes('/movie/') ||
           urlLower.includes('/series/')
  }

  /**
   * Load manifest with proxy wrapping
   */
  private async loadManifest(url: string): Promise<void> {
    if (!this.player || !this.video) return

    const proxyBase = `${SUPABASE_URL}/functions/v1/stream-proxy`
    const proxiedUrl = `${proxyBase}?url=${encodeURIComponent(url)}`

    console.log('[ShakaEnterprise] Loading:', url.substring(0, 80))

    // Direct media fallback
    if (this.isDirectMediaFile(url)) {
      console.log('[ShakaEnterprise] Direct media, using native')
      return this.loadDirectMedia(proxiedUrl)
    }

    try {
      await this.player.load(proxiedUrl)
      
      if (this.video) {
        await this.video.play()
      }

      console.log('[ShakaEnterprise] Loaded successfully')
      this.reportMetrics()
    } catch (err) {
      throw err
    }
  }

  /**
   * Load direct media file using native HTML5 video
   */
  private async loadDirectMedia(proxiedUrl: string): Promise<void> {
    if (!this.video) return

    if (this.player) {
      await this.player.detach()
    }

    return new Promise((resolve, reject) => {
      const video = this.video!

      const onCanPlay = () => {
        video.removeEventListener('canplay', onCanPlay)
        video.removeEventListener('error', onError)
        this.setState('playing')
        video.play().catch(console.error)
        resolve()
      }

      const onError = () => {
        video.removeEventListener('canplay', onCanPlay)
        video.removeEventListener('error', onError)
        reject(new Error(video.error?.message || 'Erro ao carregar mídia'))
      }

      video.addEventListener('canplay', onCanPlay)
      video.addEventListener('error', onError)
      video.src = proxiedUrl
      video.load()
    })
  }

  /**
   * Handle Shaka-specific errors
   */
  private handleShakaError(error: shaka.util.Error): void {
    if (this.destroyed) return
    
    console.error('[ShakaEnterprise] Shaka error:', error.code)

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
      this.emitError('PLAYBACK_ERROR', this.getErrorMessage(error), false)
    }
  }

  /**
   * Handle auth/token errors - refresh and retry
   */
  private async handleAuthError(): Promise<void> {
    if (this.destroyed) return
    
    console.log('[ShakaEnterprise] Auth error, refreshing token...')

    if (this.retryCount >= this.maxRetries) {
      this.setState('error')
      this.emitError('SESSION_EXPIRED', 'Sessão expirada. Recarregue a página.', false)
      return
    }

    this.retryCount++
    this.setState('reconnecting')
    this.config.onReconnecting?.(this.retryCount)

    // Exponential backoff
    const delay = Math.pow(2, this.retryCount - 1) * 1000
    await new Promise(resolve => setTimeout(resolve, delay))

    if (this.config.onTokenExpired) {
      try {
        this.streamToken = await this.config.onTokenExpired()
        console.log('[ShakaEnterprise] Token refreshed, reloading...')
        await this.reload()
      } catch (err) {
        console.error('[ShakaEnterprise] Token refresh failed:', err)
        this.handleAuthError() // Retry
      }
    } else {
      // Try without new token
      await this.reload()
    }
  }

  /**
   * Handle network errors with exponential backoff
   */
  private async handleNetworkError(): Promise<void> {
    if (this.destroyed) return

    this.retryCount++
    this.setState('reconnecting')
    this.config.onReconnecting?.(this.retryCount)

    const delay = Math.min(Math.pow(2, this.retryCount - 1) * 1000, 8000)
    console.log(`[ShakaEnterprise] Network error, retry ${this.retryCount}/${this.maxRetries} in ${delay}ms`)

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
      default:
        return 'Erro ao reproduzir vídeo'
    }
  }

  /**
   * Handle visibility change - abort on hidden
   */
  private handleVisibilityChange(): void {
    if (document.hidden && this.state === 'playing') {
      console.log('[ShakaEnterprise] Tab hidden, pausing to save egress')
      this.pause()
    }
  }

  /**
   * Start idle timeout - destroy after X seconds of pause
   */
  private startIdleTimeout(): void {
    this.clearIdleTimeout()
    
    this.idleTimeout = window.setTimeout(() => {
      if (this.state === 'paused') {
        console.log('[ShakaEnterprise] Idle timeout, destroying to save egress')
        this.destroy()
      }
    }, 60000) // 60 seconds idle = destroy
  }

  private clearIdleTimeout(): void {
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout)
      this.idleTimeout = null
    }
  }

  private handleError(error: Error): void {
    this.setState('error')
    this.emitError('UNKNOWN', error.message, false)
  }

  private setState(newState: PlayerState): void {
    if (this.state !== newState) {
      this.state = newState
      this.config.onStateChange?.(newState)
    }
  }

  private emitError(code: string, message: string, recoverable: boolean): void {
    this.config.onError?.({ code, message, recoverable }, !recoverable)
  }

  private reportMetrics(): void {
    if (!this.player || !this.video) return

    const stats = this.player.getStats()
    
    this.config.onMetrics?.({
      bufferLevel: this.video.buffered.length > 0 
        ? this.video.buffered.end(0) - this.video.currentTime 
        : 0,
      bandwidth: stats.estimatedBandwidth || 0,
      droppedFrames: stats.droppedFrames || 0,
      loadLatency: stats.loadLatency || 0,
      egressBytes: this.egressBytes
    })
  }

  // ============ PUBLIC METHODS ============

  play(): void {
    this.video?.play()
    this.clearIdleTimeout()
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

  setMuted(muted: boolean): void {
    if (this.video) {
      this.video.muted = muted
    }
  }

  async reload(): Promise<void> {
    if (this.currentUrl && this.video) {
      await this.attach(this.video, this.currentUrl, this.streamToken)
    }
  }

  async destroy(): Promise<void> {
    this.destroyed = true
    this.clearIdleTimeout()
    
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler)
    }
    
    if (this.player) {
      await this.player.destroy()
      this.player = null
    }
    this.video = null
    this.setState('idle')
    console.log('[ShakaEnterprise] Destroyed - Total egress:', this.egressBytes, 'bytes')
  }

  getState(): PlayerState {
    return this.state
  }

  getEgressBytes(): number {
    return this.egressBytes
  }

  setToken(token: string): void {
    this.streamToken = token
  }

  setLiveMode(isLive: boolean): void {
    this.isLive = isLive
    // Reconfigure if player exists
    if (this.player) {
      this.configurePlayer()
    }
  }

  getVariantTracks(): shaka.extern.Track[] {
    return this.player?.getVariantTracks() || []
  }

  selectVariantTrack(track: shaka.extern.Track): void {
    this.player?.selectVariantTrack(track, true)
  }
}
