/**
 * Player Events Service - Analytics for player events
 * 
 * Sends events to /api/player/events endpoint:
 * - play
 * - firstFrame
 * - buffering
 * - bitrateChange
 * - stop
 */

import { supabase } from '@/integrations/supabase/client';
import { authCache } from '@/services/authCacheService';

export type PlayerEventType = 
  | 'play' 
  | 'firstFrame' 
  | 'buffering' 
  | 'bitrateChange' 
  | 'stop'
  | 'error'
  | 'seek'
  | 'pause'
  | 'resume';

export interface PlayerEvent {
  event: PlayerEventType;
  contentId: string;
  contentType: 'live' | 'movie' | 'series' | 'episode';
  sessionId: string;
  timestamp: number;
  data?: Record<string, any>;
}

export interface PlayerSession {
  sessionId: string;
  contentId: string;
  contentType: string;
  startTime: number;
  deviceType: string;
  userAgent: string;
  events: PlayerEvent[];
}

class PlayerEventsService {
  private sessionId: string | null = null;
  private contentId: string | null = null;
  private contentType: string | null = null;
  private eventQueue: PlayerEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private deviceType: string;
  private hasFirstFrame: boolean = false;
  private bufferingStartTime: number | null = null;
  private lastBitrate: number = 0;
  private playStartTime: number = 0;
  
  constructor() {
    this.deviceType = this.detectDeviceType();
  }

  /**
   * Detect device type from user agent
   */
  private detectDeviceType(): string {
    const ua = navigator.userAgent.toLowerCase();
    
    if (ua.includes('tizen')) return 'samsung_tv';
    if (ua.includes('webos')) return 'lg_tv';
    if (ua.includes('android tv') || ua.includes('googletv')) return 'android_tv';
    if (ua.includes('ipad')) return 'tablet_ios';
    if (ua.includes('android') && !ua.includes('mobile')) return 'tablet_android';
    if (ua.includes('iphone')) return 'mobile_ios';
    if (ua.includes('android')) return 'mobile_android';
    if (ua.includes('mac')) return 'desktop_mac';
    if (ua.includes('windows')) return 'desktop_windows';
    return 'desktop';
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start a new playback session
   */
  startSession(contentId: string, contentType: 'live' | 'movie' | 'series' | 'episode'): string {
    // End previous session if exists
    if (this.sessionId) {
      this.endSession();
    }

    this.sessionId = this.generateSessionId();
    this.contentId = contentId;
    this.contentType = contentType;
    this.hasFirstFrame = false;
    this.bufferingStartTime = null;
    this.lastBitrate = 0;
    this.playStartTime = Date.now();
    this.eventQueue = [];

    // Start flush interval (send events every 10 seconds)
    this.flushInterval = setInterval(() => {
      this.flushEvents();
    }, 10000);

    console.log('[PlayerEvents] Session started:', this.sessionId);
    return this.sessionId;
  }

  /**
   * End playback session
   */
  endSession(): void {
    if (!this.sessionId) return;

    // Send stop event
    this.trackStop();
    
    // Flush remaining events
    this.flushEvents();

    // Clear interval
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    console.log('[PlayerEvents] Session ended:', this.sessionId);
    this.sessionId = null;
    this.contentId = null;
    this.contentType = null;
  }

  /**
   * Queue an event
   */
  private queueEvent(event: PlayerEventType, data?: Record<string, any>): void {
    if (!this.sessionId || !this.contentId || !this.contentType) return;

    const playerEvent: PlayerEvent = {
      event,
      contentId: this.contentId,
      contentType: this.contentType as PlayerEvent['contentType'],
      sessionId: this.sessionId,
      timestamp: Date.now(),
      data,
    };

    this.eventQueue.push(playerEvent);

    // Immediate flush for critical events
    if (['firstFrame', 'error', 'stop'].includes(event)) {
      this.flushEvents();
    }
  }

  /**
   * Flush events to server
   */
  private async flushEvents(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      // Try edge function first - usar cache para evitar chamadas desnecessárias
      let accessToken = authCache.getAccessToken();
      if (!accessToken) {
        const { data: { session } } = await supabase.auth.getSession();
        accessToken = session?.access_token || null;
      }
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      // Send to edge function
      const response = await fetch('/api/player/events', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sessionId: this.sessionId,
          deviceType: this.deviceType,
          events,
        }),
      });

      if (!response.ok) {
        // Fallback: send directly to Supabase
        await this.sendToSupabase(events);
      }

      console.log('[PlayerEvents] Flushed', events.length, 'events');
    } catch (error) {
      console.warn('[PlayerEvents] Failed to flush events:', error);
      // Fallback to Supabase
      await this.sendToSupabase(events);
    }
  }

  /**
   * Send events directly to Supabase (fallback)
   */
  private async sendToSupabase(events: PlayerEvent[]): Promise<void> {
    try {
      // Usar cache primeiro
      let userId = authCache.getUserId();
      if (!userId) {
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id || null;
      }
      
      const records = events.map(event => ({
        profile_id: userId || null,
        content_id: event.contentId,
        content_type: event.contentType,
        event_type: event.event,
        event_data: event.data,
        session_id: event.sessionId,
        device_type: this.deviceType,
        watch_hour: new Date(event.timestamp).getHours(),
        watch_day: new Date(event.timestamp).getDay(),
      }));

      await supabase.from('player_analytics').insert(records);
    } catch (error) {
      console.warn('[PlayerEvents] Supabase fallback failed:', error);
    }
  }

  // ==========================================================================
  // Event Tracking Methods
  // ==========================================================================

  /**
   * Track play event
   */
  trackPlay(data?: { position?: number; quality?: string }): void {
    this.playStartTime = Date.now();
    this.queueEvent('play', {
      position: data?.position || 0,
      quality: data?.quality,
    });
  }

  /**
   * Track first frame rendered
   */
  trackFirstFrame(): void {
    if (this.hasFirstFrame) return;
    this.hasFirstFrame = true;
    
    const timeToFirstFrame = Date.now() - this.playStartTime;
    this.queueEvent('firstFrame', {
      timeToFirstFrame,
    });
    
    console.log('[PlayerEvents] First frame:', timeToFirstFrame, 'ms');
  }

  /**
   * Track buffering start
   */
  trackBufferingStart(): void {
    this.bufferingStartTime = Date.now();
    this.queueEvent('buffering', {
      state: 'start',
    });
  }

  /**
   * Track buffering end
   */
  trackBufferingEnd(): void {
    const duration = this.bufferingStartTime 
      ? Date.now() - this.bufferingStartTime 
      : 0;
    
    this.queueEvent('buffering', {
      state: 'end',
      duration,
    });
    
    this.bufferingStartTime = null;
  }

  /**
   * Track bitrate change
   */
  trackBitrateChange(bitrate: number, qualityLabel: string, direction: 'up' | 'down' | 'initial'): void {
    const previousBitrate = this.lastBitrate;
    this.lastBitrate = bitrate;
    
    this.queueEvent('bitrateChange', {
      bitrate,
      qualityLabel,
      direction,
      previousBitrate,
    });
  }

  /**
   * Track stop event
   */
  trackStop(data?: { position?: number; duration?: number; reason?: string }): void {
    const watchTime = Date.now() - this.playStartTime;
    this.queueEvent('stop', {
      position: data?.position,
      duration: data?.duration,
      reason: data?.reason || 'user',
      watchTime,
    });
  }

  /**
   * Track error
   */
  trackError(errorCode: string, errorMessage: string): void {
    this.queueEvent('error', {
      errorCode,
      errorMessage,
    });
  }

  /**
   * Track seek
   */
  trackSeek(from: number, to: number): void {
    this.queueEvent('seek', {
      from,
      to,
      delta: to - from,
    });
  }

  /**
   * Track pause
   */
  trackPause(position: number): void {
    this.queueEvent('pause', { position });
  }

  /**
   * Track resume
   */
  trackResume(position: number): void {
    this.queueEvent('resume', { position });
  }

  // ==========================================================================
  // Getters
  // ==========================================================================

  getSessionId(): string | null {
    return this.sessionId;
  }

  getDeviceType(): string {
    return this.deviceType;
  }

  hasTrackedFirstFrame(): boolean {
    return this.hasFirstFrame;
  }
}

export const playerEventsService = new PlayerEventsService();
export default playerEventsService;
