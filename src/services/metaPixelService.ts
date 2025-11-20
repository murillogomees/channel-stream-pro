/**
 * Meta Pixel Service
 * Utility functions for tracking conversion events with Meta Pixel
 */

declare global {
  interface Window {
    fbq: (action: string, eventName: string, params?: Record<string, any>) => void;
  }
}

/**
 * Track a custom conversion event
 */
export const trackEvent = (eventName: string, params?: Record<string, any>) => {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', eventName, params);
    console.log('[Meta Pixel] Event tracked:', eventName, params);
  }
};

/**
 * Track lead generation (form submission)
 */
export const trackLead = (params?: { content_name?: string; value?: number; currency?: string }) => {
  trackEvent('Lead', params);
};

/**
 * Track completed registration
 */
export const trackCompleteRegistration = (params?: { content_name?: string; value?: number; currency?: string }) => {
  trackEvent('CompleteRegistration', params);
};

/**
 * Track purchase/conversion
 */
export const trackPurchase = (params: { value: number; currency: string; content_name?: string }) => {
  trackEvent('Purchase', params);
};

/**
 * Track trial start
 */
export const trackStartTrial = (params?: { value?: number; currency?: string; predicted_ltv?: number }) => {
  trackEvent('StartTrial', params);
};

/**
 * Track subscription
 */
export const trackSubscribe = (params?: { value?: number; currency?: string; predicted_ltv?: number }) => {
  trackEvent('Subscribe', params);
};

/**
 * Track custom event
 */
export const trackCustomEvent = (eventName: string, params?: Record<string, any>) => {
  trackEvent(eventName, params);
};
