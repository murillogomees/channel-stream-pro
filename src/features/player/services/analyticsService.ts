/**
 * Analytics Service - Track player events for recommendations
 */

import { supabase } from '@/integrations/supabase/client';
import { profileService } from './profileService';
import type { AnalyticsEvent, AnalyticsEventType, ContentType } from '../types';

class AnalyticsService {
  private sessionId: string | null = null;
  private deviceType: string = 'unknown';

  constructor() {
    this.detectDeviceType();
    this.sessionId = this.generateSessionId();
  }

  /**
   * Detect device type
   */
  private detectDeviceType(): void {
    const ua = navigator.userAgent.toLowerCase();
    
    if (ua.includes('tizen')) {
      this.deviceType = 'samsung_tv';
    } else if (ua.includes('webos')) {
      this.deviceType = 'lg_tv';
    } else if (ua.includes('android tv') || ua.includes('googletv')) {
      this.deviceType = 'android_tv';
    } else if (ua.includes('ipad')) {
      this.deviceType = 'tablet_ios';
    } else if (ua.includes('android') && !ua.includes('mobile')) {
      this.deviceType = 'tablet_android';
    } else if (ua.includes('iphone')) {
      this.deviceType = 'mobile_ios';
    } else if (ua.includes('android')) {
      this.deviceType = 'mobile_android';
    } else if (ua.includes('mac')) {
      this.deviceType = 'desktop_mac';
    } else if (ua.includes('windows')) {
      this.deviceType = 'desktop_windows';
    } else {
      this.deviceType = 'desktop';
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Track playback event
   */
  async trackEvent(
    eventType: AnalyticsEventType,
    contentId: string,
    contentType: ContentType,
    eventData?: Record<string, any>
  ): Promise<void> {
    const profile = await profileService.getCurrentProfile();
    if (!profile) return;

    const now = new Date();

    const event: AnalyticsEvent = {
      profile_id: profile.id,
      content_id: contentId,
      content_type: contentType,
      event_type: eventType,
      event_data: eventData,
      session_id: this.sessionId || undefined,
      device_type: this.deviceType,
      watch_hour: now.getHours(),
      watch_day: now.getDay(),
    };

    try {
      await supabase.from('player_analytics').insert(event);
    } catch (error) {
      console.error('[AnalyticsService] Error tracking event:', error);
    }
  }

  /**
   * Track play event
   */
  async trackPlay(
    contentId: string,
    contentType: ContentType,
    options?: {
      position?: number;
      quality?: string;
      category?: string;
    }
  ): Promise<void> {
    await this.trackEvent('play', contentId, contentType, {
      position: options?.position || 0,
      quality: options?.quality,
      category: options?.category,
    });
  }

  /**
   * Track pause event
   */
  async trackPause(
    contentId: string,
    contentType: ContentType,
    position: number
  ): Promise<void> {
    await this.trackEvent('pause', contentId, contentType, { position });
  }

  /**
   * Track seek event
   */
  async trackSeek(
    contentId: string,
    contentType: ContentType,
    fromPosition: number,
    toPosition: number
  ): Promise<void> {
    await this.trackEvent('seek', contentId, contentType, {
      from: fromPosition,
      to: toPosition,
      delta: toPosition - fromPosition,
    });
  }

  /**
   * Track completion event
   */
  async trackComplete(
    contentId: string,
    contentType: ContentType,
    watchDuration: number,
    totalDuration: number
  ): Promise<void> {
    await this.trackEvent('complete', contentId, contentType, {
      watch_duration: watchDuration,
      total_duration: totalDuration,
      completion_rate: totalDuration > 0 ? (watchDuration / totalDuration) * 100 : 0,
    });
  }

  /**
   * Track skip event (skip intro, next episode, etc.)
   */
  async trackSkip(
    contentId: string,
    contentType: ContentType,
    skipType: 'intro' | 'recap' | 'credits' | 'next_episode',
    fromPosition: number
  ): Promise<void> {
    await this.trackEvent('skip', contentId, contentType, {
      skip_type: skipType,
      position: fromPosition,
    });
  }

  /**
   * Track error event
   */
  async trackError(
    contentId: string,
    contentType: ContentType,
    errorMessage: string,
    errorCode?: string
  ): Promise<void> {
    await this.trackEvent('error', contentId, contentType, {
      error_message: errorMessage,
      error_code: errorCode,
    });
  }

  /**
   * Start new session
   */
  startNewSession(): void {
    this.sessionId = this.generateSessionId();
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Get device type
   */
  getDeviceType(): string {
    return this.deviceType;
  }
}

export const analyticsService = new AnalyticsService();
export default analyticsService;
