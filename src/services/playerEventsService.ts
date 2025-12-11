/**
 * Player Events Service
 * Logs player events to player_events table
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

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  startSession(contentId: string, contentType: 'live' | 'movie' | 'series' | 'episode'): string {
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

    this.flushInterval = setInterval(() => {
      this.flushEvents();
    }, 10000);

    console.log('[PlayerEvents] Session started:', this.sessionId);
    return this.sessionId;
  }

  endSession(): void {
    if (!this.sessionId) return;

    this.trackStop();
    this.flushEvents();

    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    console.log('[PlayerEvents] Session ended:', this.sessionId);
    this.sessionId = null;
    this.contentId = null;
    this.contentType = null;
  }

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

    if (['firstFrame', 'error', 'stop'].includes(event)) {
      this.flushEvents();
    }
  }

  private async flushEvents(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      const userId = authCache.getUserId();
      
      const inserts = events.map(e => ({
        user_id: userId,
        session_id: e.sessionId,
        event_type: e.event,
        content_id: e.contentId,
        content_type: e.contentType,
        event_data: e.data,
      }));

      const { error } = await supabase
        .from('player_events')
        .insert(inserts);

      if (error) {
        console.warn('[PlayerEvents] Failed to save events:', error.message);
      } else {
        console.log('[PlayerEvents] Flushed', events.length, 'events');
      }
    } catch (error) {
      console.warn('[PlayerEvents] Error flushing events:', error);
    }
  }

  trackPlay(data?: { position?: number; quality?: string }): void {
    this.playStartTime = Date.now();
    this.queueEvent('play', {
      position: data?.position || 0,
      quality: data?.quality,
    });
  }

  trackFirstFrame(): void {
    if (this.hasFirstFrame) return;
    this.hasFirstFrame = true;
    
    const timeToFirstFrame = Date.now() - this.playStartTime;
    this.queueEvent('firstFrame', { timeToFirstFrame });
    
    console.log('[PlayerEvents] First frame:', timeToFirstFrame, 'ms');
  }

  trackBufferingStart(): void {
    this.bufferingStartTime = Date.now();
    this.queueEvent('buffering', { state: 'start' });
  }

  trackBufferingEnd(): void {
    const duration = this.bufferingStartTime 
      ? Date.now() - this.bufferingStartTime 
      : 0;
    
    this.queueEvent('buffering', { state: 'end', duration });
    this.bufferingStartTime = null;
  }

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

  trackStop(data?: { position?: number; duration?: number; reason?: string }): void {
    const watchTime = Date.now() - this.playStartTime;
    this.queueEvent('stop', {
      position: data?.position,
      duration: data?.duration,
      reason: data?.reason || 'user',
      watchTime,
    });
  }

  trackError(errorCode: string, errorMessage: string): void {
    this.queueEvent('error', { errorCode, errorMessage });
  }

  trackSeek(from: number, to: number): void {
    this.queueEvent('seek', { from, to, delta: to - from });
  }

  trackPause(position: number): void {
    this.queueEvent('pause', { position });
  }

  trackResume(position: number): void {
    this.queueEvent('resume', { position });
  }

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
