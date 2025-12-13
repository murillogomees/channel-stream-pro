/**
 * PlayerEngine V3 - Enterprise HLS Engine with Auto Token Refresh
 * 
 * Features:
 * - Automatic token refresh on 403
 * - Silent reconnection without UI disruption
 * - Exponential backoff (max 3 retries)
 * - Zero URL exposure
 * - TV/Mobile/Desktop support
 */

import Hls, { Events, ErrorData, ManifestParsedData, FragLoadedData } from 'hls.js'

export interface PlayerEngineConfig {
  onStateChange?: (state: PlayerState) => void
  onError?: (error: PlayerError) => void
  onReconnecting?: (attempt: number) => void
  onTokenRefresh?: () => void
}

export type PlayerState = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'buffering' | 'reconnecting' | 'error'

export interface PlayerError {
  code: string
  message: string
  recoverable: boolean
}

// Token management state
let streamToken: string | null = null
let tokenExpiresAt = 0
let refreshInProgress = false

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

async function refreshStreamToken(): Promise<string> {
  if (refreshInProgress) {
    // Wait for ongoing refresh
    while (refreshInProgress) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    return streamToken || ''
  }

  refreshInProgress = true
  console.log('[PlayerEngineV3] Refreshing stream token...')

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/refresh-stream-token`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      }
    })

    if (!res.ok) {
      throw new Error(`Token refresh failed: ${res.status}`)
    }

    const data = await res.json()
    streamToken = data.token
    tokenExpiresAt = Date.now() + (data.expiresIn * 1000)

    console.log('[PlayerEngineV3] Token refreshed successfully, expires in', data.expiresIn, 'seconds')
    return streamToken
  } catch (err) {
    console.error('[PlayerEngineV3] Token refresh error:', err)
    throw err
  } finally {
    refreshInProgress = false
  }
}

async function ensureValidToken(): Promise<string> {
  // Refresh if token doesn't exist or expires in less than 30 seconds
  if (!streamToken || Date.now() > (tokenExpiresAt - 30000)) {
    return await refreshStreamToken()
  }
  return streamToken
}

export class PlayerEngineV3 {
  private hls: Hls | null = null
  private video: HTMLVideoElement | null = null
  private currentUrl: string | null = null
  private state: PlayerState = 'idle'
  private config: PlayerEngineConfig
  private retryCount = 0
  private maxRetries = 3
  private destroyed = false

  constructor(config: PlayerEngineConfig = {}) {
    this.config = config
  }

  private setState(state: PlayerState) {
    this.state = state
    this.config.onStateChange?.(state)
  }

  private emitError(code: string, message: string, recoverable: boolean) {
    this.config.onError?.({ code, message, recoverable })
  }

  async attach(video: HTMLVideoElement, streamUrl: string): Promise<void> {
    this.video = video
    this.currentUrl = streamUrl
    this.destroyed = false
    this.retryCount = 0

    console.log('[PlayerEngineV3] Attaching to video element')

    // Ensure we have a valid token before starting
    try {
      await ensureValidToken()
    } catch (err) {
      console.warn('[PlayerEngineV3] Initial token fetch failed, continuing anyway')
    }

    if (Hls.isSupported()) {
      await this.attachHlsJs(video, streamUrl)
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS (Safari)
      this.attachNative(video, streamUrl)
    } else {
      this.setState('error')
      this.emitError('HLS_NOT_SUPPORTED', 'Seu navegador não suporta HLS', false)
    }
  }

  private async attachHlsJs(video: HTMLVideoElement, url: string): Promise<void> {
    this.setState('loading')

    // Destroy existing instance
    if (this.hls) {
      this.hls.destroy()
    }

    this.hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 90,
      maxBufferLength: 30,
      maxBufferHole: 0.5,
      fragLoadingRetryDelay: 800,
      manifestLoadingRetryDelay: 1000,
      fragLoadingMaxRetry: 2,
      manifestLoadingMaxRetry: 2,
      levelLoadingMaxRetry: 2,
      xhrSetup: async (xhr, xhrUrl) => {
        // Ensure valid token for every request
        try {
          const token = await ensureValidToken()
          xhr.setRequestHeader('x-stream-token', token)
        } catch (err) {
          console.warn('[PlayerEngineV3] Could not set token header')
        }
        xhr.withCredentials = false
      }
    })

    // Event handlers
    this.hls.on(Events.MANIFEST_PARSED, (_event: string, data: ManifestParsedData) => {
      console.log('[PlayerEngineV3] Manifest parsed, levels:', data.levels.length)
      this.setState('ready')
      video.play().catch(() => {
        console.log('[PlayerEngineV3] Autoplay blocked')
      })
    })

    this.hls.on(Events.FRAG_LOADED, () => {
      // Reset retry count on successful fragment load
      this.retryCount = 0
    })

    this.hls.on(Events.ERROR, async (_event: string, data: ErrorData) => {
      await this.handleHlsError(data)
    })

    this.hls.attachMedia(video)
    this.hls.loadSource(url)

    // Video element events
    video.onplaying = () => this.setState('playing')
    video.onpause = () => this.setState('paused')
    video.onwaiting = () => this.setState('buffering')
  }

  private attachNative(video: HTMLVideoElement, url: string): void {
    this.setState('loading')
    video.src = url
    video.addEventListener('loadedmetadata', () => {
      this.setState('ready')
      video.play().catch(() => {})
    })
    video.addEventListener('error', () => {
      this.setState('error')
      this.emitError('NATIVE_ERROR', 'Erro ao carregar vídeo', false)
    })
  }

  private async handleHlsError(data: ErrorData): Promise<void> {
    if (this.destroyed) return

    const { type, details, response } = data
    const status = response?.code || 0

    console.error('[PlayerEngineV3] HLS Error:', type, details, 'Status:', status)

    // Handle 403 specifically - token refresh flow
    if (status === 403 || details.includes('403')) {
      await this.handle403Error()
      return
    }

    // Handle other network errors
    if (data.fatal) {
      if (type === Hls.ErrorTypes.NETWORK_ERROR) {
        await this.handleNetworkError()
      } else if (type === Hls.ErrorTypes.MEDIA_ERROR) {
        this.hls?.recoverMediaError()
      } else {
        this.setState('error')
        this.emitError('FATAL_ERROR', 'Erro fatal no player', false)
      }
    }
  }

  private async handle403Error(): Promise<void> {
    if (this.destroyed) return

    console.warn('[PlayerEngineV3] 403 Forbidden - Initiating token refresh')

    if (this.retryCount >= this.maxRetries) {
      console.error('[PlayerEngineV3] Max retries reached')
      this.setState('error')
      this.emitError('SESSION_EXPIRED', 'Sessão expirada. Recarregue a página.', false)
      return
    }

    this.retryCount++
    this.setState('reconnecting')
    this.config.onReconnecting?.(this.retryCount)

    // Exponential backoff: 1s, 2s, 4s
    const delay = Math.pow(2, this.retryCount - 1) * 1000
    console.log(`[PlayerEngineV3] Retry ${this.retryCount}/${this.maxRetries} in ${delay}ms`)

    await new Promise(resolve => setTimeout(resolve, delay))

    try {
      // Force token refresh
      streamToken = null
      tokenExpiresAt = 0
      await refreshStreamToken()
      this.config.onTokenRefresh?.()

      // Reload manifest with new token
      if (this.hls && this.currentUrl) {
        this.hls.stopLoad()
        this.hls.loadSource(this.currentUrl)
        this.hls.startLoad()
        console.log('[PlayerEngineV3] Manifest reloaded with new token')
      }
    } catch (err) {
      console.error('[PlayerEngineV3] Recovery failed:', err)
      // Recurse to retry
      await this.handle403Error()
    }
  }

  private async handleNetworkError(): Promise<void> {
    if (this.destroyed) return
    
    if (this.retryCount >= this.maxRetries) {
      this.setState('error')
      this.emitError('NETWORK_ERROR', 'Conexão instável. Verifique sua internet.', true)
      return
    }

    this.retryCount++
    this.setState('reconnecting')
    this.config.onReconnecting?.(this.retryCount)

    const delay = Math.pow(2, this.retryCount - 1) * 1000
    await new Promise(resolve => setTimeout(resolve, delay))

    this.hls?.startLoad()
  }

  play(): void {
    this.video?.play().catch(() => {})
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

  getState(): PlayerState {
    return this.state
  }

  destroy(): void {
    this.destroyed = true
    if (this.hls) {
      this.hls.destroy()
      this.hls = null
    }
    this.video = null
    this.currentUrl = null
    this.setState('idle')
  }
}
