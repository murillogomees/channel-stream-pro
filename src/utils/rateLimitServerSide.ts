/**
 * Server-Side Rate Limiting Utilities
 * 
 * Provides rate limiting helpers for Edge Functions to prevent API abuse
 */

interface RateLimitConfig {
  limit: number;
  windowSeconds: number;
  identifier: string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  blocked: boolean;
}

/**
 * Check rate limit for an identifier (IP, user ID, etc.)
 * 
 * Usage in Edge Function:
 * ```typescript
 * import { checkRateLimit } from '@/utils/rateLimitServerSide';
 * 
 * const { allowed, remaining } = await checkRateLimit(supabaseClient, {
 *   identifier: req.headers.get('x-forwarded-for') || 'unknown',
 *   limit: 5,
 *   windowSeconds: 60
 * });
 * 
 * if (!allowed) {
 *   return new Response('Rate limit exceeded', { status: 429 });
 * }
 * ```
 */
export async function checkRateLimit(
  supabaseClient: any,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const { identifier, limit, windowSeconds } = config;
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowSeconds * 1000);

  try {
    // Query existing rate limit record
    const { data: existing, error: queryError } = await supabaseClient
      .from('rate_limit_tracking')
      .select('*')
      .eq('identifier', identifier)
      .eq('identifier_type', 'ip')
      .gte('window_start', windowStart.toISOString())
      .maybeSingle();

    if (queryError && queryError.code !== 'PGRST116') {
      throw queryError;
    }

    // If no existing record or window expired, create new
    if (!existing) {
      const { error: insertError } = await supabaseClient
        .from('rate_limit_tracking')
        .insert({
          identifier,
          identifier_type: 'ip',
          request_count: 1,
          window_start: now.toISOString(),
          window_duration_seconds: windowSeconds,
          last_request_at: now.toISOString(),
        });

      if (insertError) throw insertError;

      return {
        allowed: true,
        remaining: limit - 1,
        resetAt: new Date(now.getTime() + windowSeconds * 1000),
        blocked: false,
      };
    }

    // Update existing record
    const newCount = existing.request_count + 1;
    const allowed = newCount <= limit;

    const { error: updateError } = await supabaseClient
      .from('rate_limit_tracking')
      .update({
        request_count: newCount,
        last_request_at: now.toISOString(),
      })
      .eq('id', existing.id);

    if (updateError) throw updateError;

    // If limit exceeded, check if should auto-block
    if (!allowed && newCount > limit * 2) {
      // Auto-block if exceeds limit by 2x
      await autoBlockIdentifier(supabaseClient, identifier, newCount, 'rate_limit_abuse');
    }

    return {
      allowed,
      remaining: Math.max(0, limit - newCount),
      resetAt: new Date(
        new Date(existing.window_start).getTime() + windowSeconds * 1000
      ),
      blocked: !allowed,
    };
  } catch (error) {
    console.error('[RateLimit] Error checking rate limit:', error);
    // Fail open in case of errors (allow request)
    return {
      allowed: true,
      remaining: limit,
      resetAt: new Date(now.getTime() + windowSeconds * 1000),
      blocked: false,
    };
  }
}

/**
 * Auto-block an identifier for excessive rate limit violations
 */
async function autoBlockIdentifier(
  supabaseClient: any,
  identifier: string,
  failedAttempts: number,
  reason: string
): Promise<void> {
  try {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24-hour block

    await supabaseClient.from('ip_blacklist').insert({
      ip_address: identifier,
      reason: `Auto-blocked: ${reason} (${failedAttempts} attempts)`,
      severity: 'high',
      auto_blocked: true,
      failed_attempts: failedAttempts,
      last_attempt_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
    });

    console.log(`[RateLimit] Auto-blocked ${identifier} for ${reason}`);
  } catch (error) {
    console.error('[RateLimit] Error auto-blocking:', error);
  }
}

/**
 * Check if an identifier is currently blocked
 */
export async function isBlocked(
  supabaseClient: any,
  identifier: string
): Promise<boolean> {
  try {
    const { data } = await supabaseClient
      .from('ip_blacklist')
      .select('id')
      .eq('ip_address', identifier)
      .is('unblocked_at', null)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .maybeSingle();

    return !!data;
  } catch (error) {
    console.error('[RateLimit] Error checking blocked status:', error);
    return false; // Fail open
  }
}

/**
 * Rate limit configurations for different endpoints
 */
export const RATE_LIMIT_CONFIGS = {
  // Authentication endpoints
  auth_login: { limit: 5, windowSeconds: 60 },
  auth_signup: { limit: 3, windowSeconds: 300 },
  auth_password_reset: { limit: 3, windowSeconds: 300 },

  // Admin endpoints
  create_admin_user: { limit: 5, windowSeconds: 60 },
  admin_mutation: { limit: 30, windowSeconds: 60 },

  // Public APIs
  generate_m3u: { limit: 10, windowSeconds: 3600 },
  stream_proxy: { limit: 100, windowSeconds: 60 },
  cdn_token: { limit: 20, windowSeconds: 60 },

  // Webhooks (higher limits)
  webhook_whatsapp: { limit: 1000, windowSeconds: 60 },
  webhook_payment: { limit: 100, windowSeconds: 60 },

  // Default fallback
  default: { limit: 60, windowSeconds: 60 },
} as const;

/**
 * Get rate limit config by endpoint name
 */
export function getRateLimitConfig(endpoint: string): RateLimitConfig {
  const config = RATE_LIMIT_CONFIGS[endpoint as keyof typeof RATE_LIMIT_CONFIGS] || RATE_LIMIT_CONFIGS.default;
  return {
    ...config,
    identifier: '', // Will be set by caller
  };
}
