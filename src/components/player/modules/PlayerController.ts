/**
 * PlayerController - Controlador principal do player IPTV
 * 
 * Responsabilidades:
 * - Inicializar engine
 * - Gerenciar ciclo de vida
 * - Recriar player sem reload de página
 * - Pausar / resumir corretamente
 */

import Hls, { Events, ErrorData, ManifestParsedData } from 'hls.js'
import { TokenManager, tokenManager } from './TokenManager'
import { StreamResolver, streamResolver } from './StreamResolver'
import { BufferManager } from './BufferManager'
import { ErrorManager, PlayerError } from './ErrorManager'

export type PlayerState = 
  | 'idle'
  | 'initializing'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'buffering'
  | 'recovering'
  | 'error'
  | 'destroyed'

export interface SessionMetrics {
  sessionId: string
  startTime: number
  bufferingEvents: number
  errorCount: number
  totalPlayTime: number
}

export interface PlayerControllerConfig {
  onStateChange?: (state: PlayerState) => void
  onError?: (error: PlayerError) => void
  onRecovering?: (attempt: number) => void
  onMetrics?: (metrics: Record<string, unknown>) => void
}

export class PlayerController {
  private hls: Hls | null = null
  private video: HTMLVideoElement | null = null
  private currentUrl: string | null = null
  private state: PlayerState = 'idle'
  private config: PlayerControllerConfig
  
  // Modules
  private tokenManager: TokenManager
  private streamResolver: StreamResolver
  private bufferManager: BufferManager
  private errorManager: ErrorManager
  
  // Simple metrics
  private sessionId: string = crypto.randomUUID()
  private sessionStartTime: number = Date.now()
  private bufferingEvents: number = 0
  private errorCount: number = 0

  constructor(config: PlayerControllerConfig = {}) {
    this.config = config
    this.tokenManager = tokenManager
    this.streamResolver = streamResolver
    this.bufferManager = new BufferManager()
    
    this.errorManager = new ErrorManager({
      onRecoverable: (error) => this.handleRecoverableError(error),
      onCritical: (error) => this.handleCriticalError(error),
      onFatal: (error) => this.handleFatalError(error),
      onRetry: (attempt) => this.config.onRecovering?.(attempt)
    })
  }

  /**
   * Initialize player with video element
   */
  async init(video: HTMLVideoElement, streamUrl: string, userId?: string, contentId?: string): Promise<void> {
    this.video = video
    this.currentUrl = streamUrl
    this.setState('initializing')
    
    // Reset session
    this.sessionId = crypto.randomUUID()
    this.sessionStartTime = Date.now()
    this.bufferingEvents = 0
    this.errorCount = 0

    // Ensure we have a valid token before starting
    try {
      await this.tokenManager.getToken()
    } catch (err) {
      console.warn('[PlayerController] Initial token fetch failed, continuing...')
    }

    // Setup HLS
    if (Hls.isSupported()) {
      await this.setupHls(video, streamUrl)
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      this.setupNative(video, streamUrl)
    } else {
      this.setState('error')
      this.errorManager.handle(new Error('HLS not supported'))
    }
  }

  /**
   * Start playback
   */
  play(): void {
    if (this.video) {
      this.video.play().catch((err) => {
        console.warn('[PlayerController] Play failed:', err.message)
      })
    }
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (this.video) {
      this.video.pause()
    }
  }

  /**
   * Toggle play/pause
   */
  togglePlay(): void {
    if (this.state === 'playing') {
      this.pause()
    } else {
      this.play()
    }
  }

  /**
   * Seek to position
   */
  seek(time: number): void {
    if (this.video) {
      this.video.currentTime = time
    }
  }

  /**
   * Set volume (0-1)
   */
  setVolume(volume: number): void {
    if (this.video) {
      this.video.volume = Math.max(0, Math.min(1, volume))
    }
  }

  /**
   * Reload stream without destroying player
   */
  async reloadStream(): Promise<void> {
    if (!this.currentUrl || !this.video) return
    
    // Force token refresh
    this.tokenManager.invalidate()
    await this.tokenManager.getToken()
    
    if (this.hls) {
      this.hls.stopLoad()
      const proxyUrl = this.streamResolver.resolve(this.currentUrl)
      this.hls.loadSource(proxyUrl)
      this.hls.startLoad()
    }
  }

  /**
   * Destroy player and cleanup
   */
  destroy(): void {
    this.setState('destroyed')
    
    if (this.hls) {
      this.hls.destroy()
      this.hls = null
    }
    
    this.bufferManager.detach()
    this.errorManager.clearHistory()
    
    this.video = null
    this.currentUrl = null
  }

  /**
   * Get current state
   */
  getState(): PlayerState {
    return this.state
  }

  /**
   * Get HLS instance (for advanced usage)
   */
  getHls(): Hls | null {
    return this.hls
  }

  /**
   * Get metrics summary
   */
  getMetrics(): SessionMetrics {
    return {
      sessionId: this.sessionId,
      startTime: this.sessionStartTime,
      bufferingEvents: this.bufferingEvents,
      errorCount: this.errorCount,
      totalPlayTime: Date.now() - this.sessionStartTime
    }
  }

  getSessionId(): string {
    return this.sessionId
  }

  private setState(state: PlayerState): void {
    this.state = state
    this.config.onStateChange?.(state)
  }

  private async setupHls(video: HTMLVideoElement, url: string): Promise<void> {
    this.setState('loading')

    if (this.hls) {
      this.hls.destroy()
    }

    const bufferConfig = this.bufferManager.getHlsConfig()

    this.hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      ...bufferConfig,
      fragLoadingRetryDelay: 500,
      manifestLoadingRetryDelay: 1000,
      fragLoadingMaxRetry: 3,
      manifestLoadingMaxRetry: 3,
      levelLoadingMaxRetry: 3,
      // Synchronous XHR setup - only use cached token
      xhrSetup: (xhr) => {
        const token = this.tokenManager.getTokenSync()
        if (token) {
          xhr.setRequestHeader('x-stream-token', token)
        }
        xhr.setRequestHeader('x-session-id', this.sessionId)
        xhr.withCredentials = false
      }
    })

    // Attach buffer manager
    this.bufferManager.attach(this.hls, video)

    // Event handlers
    this.hls.on(Events.MANIFEST_PARSED, (_event: string, data: ManifestParsedData) => {
      console.log('[PlayerController] Manifest parsed, levels:', data.levels.length)
      this.setState('ready')
      this.play()
    })

    this.hls.on(Events.FRAG_LOADED, () => {
      // Reset error count on successful fragment
      this.errorManager.resetRetries()
    })

    this.hls.on(Events.ERROR, async (_event: string, data: ErrorData) => {
      await this.handleHlsError(data)
    })

    // Video element events
    video.onplaying = () => {
      this.setState('playing')
    }
    
    video.onpause = () => {
      if (this.state !== 'buffering' && this.state !== 'recovering') {
        this.setState('paused')
      }
    }
    
    video.onwaiting = () => {
      this.setState('buffering')
      this.bufferingEvents++
    }
    
    video.onplaying = () => {
      this.setState('playing')
    }

    // Load source through proxy
    const proxyUrl = this.streamResolver.resolve(url)
    this.hls.attachMedia(video)
    this.hls.loadSource(proxyUrl)
  }

  private setupNative(video: HTMLVideoElement, url: string): void {
    this.setState('loading')
    
    const proxyUrl = this.streamResolver.resolve(url)
    video.src = proxyUrl
    
    video.addEventListener('loadedmetadata', () => {
      this.setState('ready')
      this.play()
    })
    
    video.addEventListener('error', () => {
      this.setState('error')
      this.errorManager.handle(new Error('Native playback error'))
    })
  }

  private async handleHlsError(data: ErrorData): Promise<void> {
    const { type, details, response, fatal } = data
    const httpStatus = response?.code

    console.error('[PlayerController] HLS Error:', type, details, 'Status:', httpStatus)
    this.errorCount++

    // Handle 403 specifically
    if (httpStatus === 403 || details.includes('403')) {
      await this.handleAuthError()
      return
    }

    // Handle other errors
    const error = this.errorManager.handle(
      new Error(`${type}: ${details}`),
      httpStatus
    )

    this.config.onError?.(error)

    if (fatal) {
      if (type === Hls.ErrorTypes.NETWORK_ERROR) {
        await this.handleNetworkError()
      } else if (type === Hls.ErrorTypes.MEDIA_ERROR) {
        this.hls?.recoverMediaError()
      } else {
        this.setState('error')
      }
    }
  }

  private async handleAuthError(): Promise<void> {
    if (!this.errorManager.shouldRetry()) {
      this.setState('error')
      this.config.onError?.(this.errorManager.handle(new Error('Max retries exceeded')))
      return
    }

    const attempt = this.errorManager.incrementRetry()
    const delay = this.errorManager.getRetryDelay()
    
    console.log(`[PlayerController] Auth error, retry ${attempt}/3 in ${delay}ms`)
    this.setState('recovering')
    this.config.onRecovering?.(attempt)

    await new Promise(resolve => setTimeout(resolve, delay))

    try {
      this.tokenManager.invalidate()
      await this.tokenManager.getToken()
      await this.reloadStream()
    } catch (err) {
      console.error('[PlayerController] Recovery failed:', err)
      if (this.errorManager.shouldRetry()) {
        await this.handleAuthError() // Retry
      } else {
        this.setState('error')
      }
    }
  }

  private async handleNetworkError(): Promise<void> {
    if (!this.errorManager.shouldRetry()) {
      this.setState('error')
      return
    }

    const attempt = this.errorManager.incrementRetry()
    const delay = this.errorManager.getRetryDelay()
    
    console.log(`[PlayerController] Network error, retry ${attempt}/3 in ${delay}ms`)
    this.setState('recovering')

    await new Promise(resolve => setTimeout(resolve, delay))
    
    this.hls?.startLoad()
  }

  private handleRecoverableError(error: PlayerError): void {
    console.log('[PlayerController] Recoverable error:', error.message)
  }

  private handleCriticalError(error: PlayerError): void {
    console.warn('[PlayerController] Critical error:', error.message)
    this.config.onError?.(error)
  }

  private handleFatalError(error: PlayerError): void {
    console.error('[PlayerController] Fatal error:', error.message)
    this.setState('error')
    this.config.onError?.(error)
  }
}
