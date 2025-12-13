/**
 * MetricsCollector - Coleta de métricas do player
 * 
 * Responsabilidades:
 * - Tempo de buffer
 * - Erros por stream
 * - Tempo até first frame
 * - Envio para Supabase
 */

import { supabase } from '@/integrations/supabase/client'

export type MetricEvent = 
  | 'player_init'
  | 'stream_load_start'
  | 'stream_load_complete'
  | 'first_frame'
  | 'buffering_start'
  | 'buffering_end'
  | 'error'
  | 'quality_change'
  | 'seek'
  | 'pause'
  | 'resume'
  | 'destroy'

export interface Metric {
  event: MetricEvent
  timestamp: number
  data?: Record<string, unknown>
  duration?: number
}

export interface SessionMetrics {
  sessionId: string
  userId?: string
  contentId?: string
  contentType?: string
  startTime: number
  metrics: Metric[]
  errors: number
  bufferingTime: number
  timeToFirstFrame?: number
}

export class MetricsCollector {
  private sessionId: string
  private userId?: string
  private contentId?: string
  private contentType?: string
  private startTime: number
  private metrics: Metric[] = []
  private bufferingStartTime: number | null = null
  private totalBufferingTime = 0
  private loadStartTime: number | null = null
  private firstFrameTime: number | null = null
  private errorCount = 0
  private reportInterval: ReturnType<typeof setInterval> | null = null

  constructor() {
    this.sessionId = this.generateSessionId()
    this.startTime = Date.now()
  }

  /**
   * Initialize with user and content info
   */
  init(userId?: string, contentId?: string, contentType?: string): void {
    this.userId = userId
    this.contentId = contentId
    this.contentType = contentType
    this.report('player_init')
    this.startPeriodicReporting()
  }

  /**
   * Report a metric event
   */
  report(event: MetricEvent, data?: Record<string, unknown>): void {
    const metric: Metric = {
      event,
      timestamp: Date.now(),
      data
    }

    // Handle special events
    switch (event) {
      case 'stream_load_start':
        this.loadStartTime = Date.now()
        break
        
      case 'stream_load_complete':
        if (this.loadStartTime) {
          metric.duration = Date.now() - this.loadStartTime
        }
        break
        
      case 'first_frame':
        if (this.loadStartTime) {
          this.firstFrameTime = Date.now() - this.loadStartTime
          metric.duration = this.firstFrameTime
        }
        break
        
      case 'buffering_start':
        this.bufferingStartTime = Date.now()
        break
        
      case 'buffering_end':
        if (this.bufferingStartTime) {
          const bufferingDuration = Date.now() - this.bufferingStartTime
          this.totalBufferingTime += bufferingDuration
          metric.duration = bufferingDuration
          this.bufferingStartTime = null
        }
        break
        
      case 'error':
        this.errorCount++
        break
    }

    this.metrics.push(metric)
    console.log('[MetricsCollector]', event, data || '')
  }

  /**
   * Get session summary
   */
  getSummary(): SessionMetrics {
    return {
      sessionId: this.sessionId,
      userId: this.userId,
      contentId: this.contentId,
      contentType: this.contentType,
      startTime: this.startTime,
      metrics: this.metrics,
      errors: this.errorCount,
      bufferingTime: this.totalBufferingTime,
      timeToFirstFrame: this.firstFrameTime || undefined
    }
  }

  /**
   * Send metrics to Supabase
   */
  async flush(): Promise<void> {
    if (this.metrics.length === 0) return

    try {
      const summary = this.getSummary()
      
      // Convert metrics to JSON-serializable format (as any to satisfy Json type)
      const metricsData = summary.metrics.slice(-50).map(m => ({
        event: m.event as string,
        timestamp: m.timestamp,
        data: m.data ? JSON.parse(JSON.stringify(m.data)) : null,
        duration: m.duration ?? null
      }))
      
      await supabase.from('player_events').insert([{
        session_id: summary.sessionId,
        user_id: summary.userId,
        content_id: summary.contentId,
        content_type: summary.contentType,
        event_type: 'session_metrics',
        event_data: JSON.parse(JSON.stringify({
          metrics: metricsData,
          errors: summary.errors,
          bufferingTime: summary.bufferingTime,
          timeToFirstFrame: summary.timeToFirstFrame ?? null,
          sessionDuration: Date.now() - summary.startTime
        }))
      }])

      console.log('[MetricsCollector] Metrics flushed to Supabase')
    } catch (err) {
      console.error('[MetricsCollector] Failed to flush metrics:', err)
    }
  }

  /**
   * Destroy and cleanup
   */
  destroy(): void {
    this.report('destroy')
    this.stopPeriodicReporting()
    this.flush() // Final flush
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId
  }

  private generateSessionId(): string {
    return `ps_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  private startPeriodicReporting(): void {
    this.stopPeriodicReporting()
    
    // Report every 30 seconds
    this.reportInterval = setInterval(() => {
      this.flush()
    }, 30000)
  }

  private stopPeriodicReporting(): void {
    if (this.reportInterval) {
      clearInterval(this.reportInterval)
      this.reportInterval = null
    }
  }
}
