/**
 * BufferManager - Gerenciamento de buffer do player
 * 
 * Responsabilidades:
 * - Buffer mínimo/máximo
 * - Latência controlada
 * - Auto-recovery
 * - Evitar buffer overflow
 */

import Hls from 'hls.js'

export interface BufferConfig {
  minBuffer: number
  maxBuffer: number
  backBuffer: number
  targetLatency: number
  maxHole: number
}

export interface BufferStats {
  currentLevel: number
  targetLevel: number
  isHealthy: boolean
  latency: number
}

const DEFAULT_CONFIG: BufferConfig = {
  minBuffer: 15,
  maxBuffer: 30,
  backBuffer: 90,
  targetLatency: 3,
  maxHole: 0.5
}

export class BufferManager {
  private hls: Hls | null = null
  private video: HTMLVideoElement | null = null
  private config: BufferConfig
  private monitorInterval: ReturnType<typeof setInterval> | null = null

  constructor(config: Partial<BufferConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Attach to HLS instance and video element
   */
  attach(hls: Hls, video: HTMLVideoElement): void {
    this.hls = hls
    this.video = video
    this.startMonitoring()
  }

  /**
   * Detach and cleanup
   */
  detach(): void {
    this.stopMonitoring()
    this.hls = null
    this.video = null
  }

  /**
   * Optimize buffer settings based on conditions
   */
  optimize(): void {
    if (!this.hls) return

    const stats = this.getStats()
    
    if (!stats.isHealthy) {
      console.log('[BufferManager] Buffer unhealthy, triggering recovery')
      this.recover()
    }
  }

  /**
   * Clear buffer and restart
   */
  clear(): void {
    if (!this.hls) return
    
    this.hls.stopLoad()
    setTimeout(() => {
      this.hls?.startLoad()
    }, 100)
    
    console.log('[BufferManager] Buffer cleared')
  }

  /**
   * Get current buffer stats
   */
  getStats(): BufferStats {
    if (!this.video) {
      return {
        currentLevel: 0,
        targetLevel: this.config.minBuffer,
        isHealthy: false,
        latency: 0
      }
    }

    const buffered = this.video.buffered
    let currentLevel = 0
    
    if (buffered.length > 0) {
      const currentTime = this.video.currentTime
      for (let i = 0; i < buffered.length; i++) {
        if (currentTime >= buffered.start(i) && currentTime <= buffered.end(i)) {
          currentLevel = buffered.end(i) - currentTime
          break
        }
      }
    }

    const latency = this.calculateLatency()
    const isHealthy = currentLevel >= this.config.minBuffer && 
                      currentLevel <= this.config.maxBuffer

    return {
      currentLevel,
      targetLevel: this.config.minBuffer,
      isHealthy,
      latency
    }
  }

  /**
   * Get HLS config for buffer settings
   */
  getHlsConfig(): Partial<Hls['config']> {
    return {
      backBufferLength: this.config.backBuffer,
      maxBufferLength: this.config.maxBuffer,
      maxBufferHole: this.config.maxHole,
      lowLatencyMode: false, // Disabled for stability
    }
  }

  private recover(): void {
    if (!this.hls || !this.video) return

    const currentTime = this.video.currentTime
    
    // Try media error recovery first
    this.hls.recoverMediaError()
    
    // If still stuck, try restart
    setTimeout(() => {
      if (this.video && this.video.paused && !this.video.ended) {
        console.log('[BufferManager] Forcing playback restart')
        this.video.play().catch(() => {})
      }
    }, 1000)
  }

  private calculateLatency(): number {
    if (!this.video || !this.video.duration || !isFinite(this.video.duration)) {
      return 0
    }
    
    // For live streams, latency = duration - currentTime
    // This is approximate
    const buffered = this.video.buffered
    if (buffered.length > 0) {
      const edge = buffered.end(buffered.length - 1)
      return edge - this.video.currentTime
    }
    
    return 0
  }

  private startMonitoring(): void {
    this.stopMonitoring()
    
    this.monitorInterval = setInterval(() => {
      this.optimize()
    }, 5000)
  }

  private stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval)
      this.monitorInterval = null
    }
  }
}
