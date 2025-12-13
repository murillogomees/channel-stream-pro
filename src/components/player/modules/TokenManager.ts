/**
 * TokenManager - Gerenciamento de tokens de stream
 * 
 * Responsabilidades:
 * - Solicitar token
 * - Armazenar TTL
 * - Renovar automaticamente
 * - Evitar múltiplos refresh simultâneos
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export interface TokenData {
  token: string
  expiresAt: number
  generatedAt: number
}

export class TokenManager {
  private static instance: TokenManager
  private tokenData: TokenData | null = null
  private refreshPromise: Promise<string> | null = null
  private readonly bufferTime = 30000 // 30 seconds before expiry

  private constructor() {}

  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager()
    }
    return TokenManager.instance
  }

  /**
   * Get current valid token, refreshing if needed
   */
  async getToken(): Promise<string> {
    if (this.isExpired()) {
      return await this.refreshToken()
    }
    return this.tokenData?.token || await this.refreshToken()
  }

  /**
   * Get token synchronously (for XHR setup - no await)
   */
  getTokenSync(): string | null {
    if (this.tokenData && !this.isExpired()) {
      return this.tokenData.token
    }
    return null
  }

  /**
   * Check if current token is expired or will expire soon
   */
  isExpired(): boolean {
    if (!this.tokenData) return true
    return Date.now() >= (this.tokenData.expiresAt - this.bufferTime)
  }

  /**
   * Refresh token - prevents concurrent refresh calls
   */
  async refreshToken(): Promise<string> {
    // If refresh is already in progress, wait for it
    if (this.refreshPromise) {
      return await this.refreshPromise
    }

    this.refreshPromise = this.doRefresh()
    
    try {
      const token = await this.refreshPromise
      return token
    } finally {
      this.refreshPromise = null
    }
  }

  /**
   * Force invalidate current token
   */
  invalidate(): void {
    this.tokenData = null
    console.log('[TokenManager] Token invalidated')
  }

  /**
   * Get token TTL in seconds
   */
  getTTL(): number {
    if (!this.tokenData) return 0
    const remaining = this.tokenData.expiresAt - Date.now()
    return Math.max(0, Math.floor(remaining / 1000))
  }

  private async doRefresh(): Promise<string> {
    console.log('[TokenManager] Refreshing token...')

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/refresh-stream-token`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        }
      })

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`)
      }

      const data = await response.json()
      
      this.tokenData = {
        token: data.token,
        expiresAt: Date.now() + (data.expiresIn * 1000),
        generatedAt: data.generatedAt || Date.now()
      }

      console.log('[TokenManager] Token refreshed, TTL:', data.expiresIn, 'seconds')
      return this.tokenData.token
    } catch (err) {
      console.error('[TokenManager] Refresh failed:', err)
      throw err
    }
  }
}

export const tokenManager = TokenManager.getInstance()
