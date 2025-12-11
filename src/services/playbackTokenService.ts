/**
 * Playback Token Service - Simplified
 * Uses profiles table for subscription check
 */

import { supabase } from "@/lib/supabase";
import { SUPABASE_FUNCTIONS_URL } from "@/config/supabase";

export interface PlaybackToken {
  token: string;
  expires_at: string;
  permissions: {
    can_play: boolean;
    max_quality: string;
  };
}

export interface TokenValidation {
  valid: boolean;
  user_id?: string;
  permissions?: {
    can_play: boolean;
    max_quality: string;
  };
  expires_at?: string;
  error?: string;
  subscription_required?: boolean;
}

class PlaybackTokenService {
  private functionUrl = SUPABASE_FUNCTIONS_URL;
  private tokenCache: Map<string, { token: PlaybackToken; expiresAt: number }> = new Map();
  private refreshThreshold = 5 * 60 * 1000;

  /**
   * Generate a playback token for content
   */
  async generateToken(
    contentId?: string,
    contentType: "live" | "vod" = "live"
  ): Promise<PlaybackToken> {
    const cacheKey = `${contentId || "*"}_${contentType}`;
    const cached = this.tokenCache.get(cacheKey);
    
    if (cached && cached.expiresAt > Date.now() + this.refreshThreshold) {
      return cached.token;
    }

    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error("User not authenticated");
    }

    const response = await fetch(`${this.functionUrl}/playback-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        action: "generate",
        content_id: contentId,
        content_type: contentType,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      if (data.subscription_required) {
        throw new SubscriptionRequiredError(data.status);
      }
      throw new Error(data.error || "Failed to generate token");
    }

    this.tokenCache.set(cacheKey, {
      token: data,
      expiresAt: new Date(data.expires_at).getTime(),
    });

    return data;
  }

  /**
   * Validate a playback token
   */
  async validateToken(
    token: string,
    contentId?: string,
    ipAddress?: string
  ): Promise<TokenValidation> {
    const response = await fetch(`${this.functionUrl}/playback-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "validate",
        token,
        content_id: contentId,
        ip_address: ipAddress,
      }),
    });

    return response.json();
  }

  /**
   * Get a valid token, refreshing if needed
   */
  async getValidToken(
    contentId?: string,
    contentType: "live" | "vod" = "live"
  ): Promise<string> {
    const tokenData = await this.generateToken(contentId, contentType);
    return tokenData.token;
  }

  /**
   * Clear token cache
   */
  clearCache(): void {
    this.tokenCache.clear();
  }

  /**
   * Build a streaming URL with token
   */
  buildStreamUrl(baseUrl: string, token: string): string {
    const url = new URL(baseUrl);
    url.searchParams.set("token", token);
    return url.toString();
  }

  /**
   * Check if user can play content using profiles table
   */
  async canPlay(): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data } = await supabase
        .from('profiles')
        .select('situacao, data_vencimento')
        .eq('id', user.id)
        .maybeSingle();

      if (!data) return false;

      // Check if subscription is active
      if (data.situacao === 'Ativo' || data.situacao === 'Testando') {
        if (data.data_vencimento) {
          return new Date(data.data_vencimento) > new Date();
        }
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }
}

// Custom error for subscription requirements
export class SubscriptionRequiredError extends Error {
  public status: string;

  constructor(status: string) {
    super("Active subscription required for playback");
    this.name = "SubscriptionRequiredError";
    this.status = status;
  }
}

export const playbackTokenService = new PlaybackTokenService();
export default playbackTokenService;
