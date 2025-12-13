/**
 * Custom Auth Service - Complete GoTrue Replacement
 * @version 5.0.0
 * 
 * Full authentication system bypassing GoTrue entirely.
 * Uses direct database authentication via Edge Function.
 * 
 * Features:
 * - Email/Password authentication
 * - Rate limiting & brute force protection
 * - Refresh token rotation
 * - Session management
 * - Password reset
 * - Email verification
 * - MFA/2FA support
 * - OAuth placeholder (future)
 */

// Self-hosted Supabase - Primary instance
const SUPABASE_URL = 'https://supabase.iptvlink.com.br';
const SUPABASE_ANON_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NTIyMDgyMCwiZXhwIjo0OTIwODk0NDIwLCJyb2xlIjoiYW5vbiJ9.55tQdiEEa0mlCvveFpQZwMHqDZt0DzAgUQOPpLCNDLU';

const STORAGE_KEY = 'custom_auth_session';
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // Refresh 5 min before expiry

export interface CustomAuthUser {
  id: string;
  email: string;
  role: string;
  email_confirmed_at?: string;
  phone?: string;
  phone_confirmed_at?: string;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
  profile?: Record<string, any>;
  mfa_enabled?: boolean;
  last_sign_in_at?: string;
  created_at?: string;
}

export interface CustomAuthSession {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  expires_at: number;
  user: CustomAuthUser;
}

export interface UserSession {
  id: string;
  device_info: Record<string, any>;
  ip_address: string;
  user_agent: string;
  is_active: boolean;
  last_activity: string;
  expires_at: string;
  created_at: string;
  is_current?: boolean;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordUpdateRequest {
  current_password?: string;
  new_password: string;
  token?: string;
}

export interface SignUpOptions {
  email: string;
  password: string;
  userData?: Record<string, any>;
  emailRedirectTo?: string;
}

export interface SignInOptions {
  email: string;
  password: string;
  mfaCode?: string;
}

type AuthEvent = 
  | 'SIGNED_IN' 
  | 'SIGNED_OUT' 
  | 'TOKEN_REFRESHED' 
  | 'USER_UPDATED' 
  | 'PASSWORD_RECOVERY'
  | 'MFA_CHALLENGE_VERIFIED'
  | 'INITIAL_SESSION';

type AuthStateChangeCallback = (event: AuthEvent, session: CustomAuthSession | null) => void;

interface AuthError {
  message: string;
  code?: string;
  status?: number;
}

interface AuthResponse<T> {
  data: T | null;
  error: AuthError | null;
}

class CustomAuthService {
  private session: CustomAuthSession | null = null;
  private listeners: AuthStateChangeCallback[] = [];
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private deviceFingerprint: string = '';

  constructor() {
    this.loadSession();
    this.generateDeviceFingerprint();
  }

  /**
   * Generate a unique device fingerprint for session tracking
   */
  private generateDeviceFingerprint(): void {
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || 0,
    ];
    this.deviceFingerprint = btoa(components.join('|')).substring(0, 32);
  }

  /**
   * Load session from localStorage
   */
  private loadSession(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const session = JSON.parse(stored) as CustomAuthSession;
        // Check if token is not expired
        if (session.expires_at > Date.now()) {
          this.session = session;
          this.scheduleTokenRefresh();
        } else {
          // Try to refresh if we have a refresh token
          if (session.refresh_token) {
            this.session = session;
            this.refreshSession().catch(() => {
              this.clearSession();
            });
          } else {
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      }
    } catch (e) {
      console.error('[CustomAuth] Error loading session:', e);
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  /**
   * Save session to localStorage
   */
  private saveSession(session: CustomAuthSession): void {
    session.expires_at = Date.now() + (session.expires_in * 1000);
    this.session = session;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    this.scheduleTokenRefresh();
    this.notifyListeners('SIGNED_IN', session);
  }

  /**
   * Clear session from memory and storage
   */
  private clearSession(): void {
    this.session = null;
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    localStorage.removeItem(STORAGE_KEY);
    this.notifyListeners('SIGNED_OUT', null);
  }

  /**
   * Schedule automatic token refresh
   */
  private scheduleTokenRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    if (!this.session) return;

    const msUntilExpiry = this.session.expires_at - Date.now();
    const refreshIn = Math.max(msUntilExpiry - REFRESH_THRESHOLD_MS, 0);

    if (refreshIn > 0) {
      this.refreshTimer = setTimeout(() => {
        this.refreshSession().catch((e) => {
          console.error('[CustomAuth] Auto refresh failed:', e);
        });
      }, refreshIn);
    }
  }

  /**
   * Notify all listeners of auth state change
   */
  private notifyListeners(event: AuthEvent, session: CustomAuthSession | null): void {
    this.listeners.forEach(callback => {
      try {
        callback(event, session);
      } catch (e) {
        console.error('[CustomAuth] Error in auth listener:', e);
      }
    });
  }

  /**
   * Call the custom auth edge function
   */
  private async callAuthEndpoint(action: string, data: Record<string, any> = {}): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'x-device-fingerprint': this.deviceFingerprint,
    };

    if (this.session?.access_token) {
      headers['Authorization'] = `Bearer ${this.session.access_token}`;
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/custom-auth`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, ...data })
    });

    const result = await response.json();
    
    if (!response.ok) {
      const error: AuthError = {
        message: result.error || result.message || 'Authentication failed',
        code: result.code,
        status: response.status
      };
      throw error;
    }
    
    return result;
  }

  // ==========================================
  // AUTHENTICATION METHODS
  // ==========================================

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string, options?: { mfaCode?: string }): Promise<AuthResponse<{ session: CustomAuthSession; user: CustomAuthUser }>> {
    try {
      const result = await this.callAuthEndpoint('login', { 
        email, 
        password,
        mfa_code: options?.mfaCode 
      });
      
      // Check for MFA challenge
      if (result.mfa_required) {
        return {
          data: null,
          error: {
            message: 'MFA code required',
            code: 'MFA_REQUIRED'
          }
        };
      }
      
      if (!result.access_token) {
        throw { message: result.message || result.error || 'Authentication failed - invalid response' };
      }
      
      // Extract app_role from JWT payload
      let appRole = result.user?.role || 'client';
      try {
        const [, payloadBase64] = result.access_token.split('.');
        if (payloadBase64) {
          const jwtPayload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
          appRole = jwtPayload.app_role || jwtPayload.role || appRole;
        }
      } catch (e) {
        console.warn('[CustomAuth] Could not parse JWT payload:', e);
      }
      
      const session: CustomAuthSession = {
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        token_type: result.token_type || 'bearer',
        expires_in: result.expires_in,
        expires_at: Date.now() + (result.expires_in * 1000),
        user: {
          ...result.user,
          role: appRole
        }
      };
      
      this.saveSession(session);
      
      return { data: { session, user: session.user }, error: null };
    } catch (error: any) {
      return { data: null, error: { message: error.message || 'Sign in failed', code: error.code } };
    }
  }

  /**
   * Sign up with email and password
   */
  async signUp(email: string, password: string, userData?: Record<string, any>): Promise<AuthResponse<{ session: CustomAuthSession; user: CustomAuthUser }>> {
    try {
      const result = await this.callAuthEndpoint('signup', { email, password, userData });
      
      if (!result.access_token) {
        throw { message: result.message || result.error || 'Sign up failed' };
      }
      
      const session: CustomAuthSession = {
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        token_type: result.token_type || 'bearer',
        expires_in: result.expires_in,
        expires_at: Date.now() + (result.expires_in * 1000),
        user: result.user
      };
      
      this.saveSession(session);
      
      return { data: { session, user: result.user }, error: null };
    } catch (error: any) {
      return { data: null, error: { message: error.message || 'Sign up failed', code: error.code } };
    }
  }

  /**
   * Sign out current user
   */
  async signOut(): Promise<AuthResponse<null>> {
    try {
      await this.callAuthEndpoint('logout');
      this.clearSession();
      return { data: null, error: null };
    } catch (error: any) {
      this.clearSession(); // Clear anyway
      return { data: null, error: { message: error.message } };
    }
  }

  /**
   * Sign out from all devices
   */
  async signOutAll(): Promise<AuthResponse<null>> {
    try {
      await this.callAuthEndpoint('logout-all');
      this.clearSession();
      return { data: null, error: null };
    } catch (error: any) {
      this.clearSession();
      return { data: null, error: { message: error.message } };
    }
  }

  // ==========================================
  // SESSION METHODS
  // ==========================================

  /**
   * Get current session
   */
  async getSession(): Promise<AuthResponse<{ session: CustomAuthSession | null }>> {
    if (!this.session) {
      return { data: { session: null }, error: null };
    }

    // Check if token is expired or about to expire
    if (this.session.expires_at <= Date.now() + REFRESH_THRESHOLD_MS) {
      try {
        await this.refreshSession();
      } catch (e) {
        this.clearSession();
        return { data: { session: null }, error: null };
      }
    }

    return { data: { session: this.session }, error: null };
  }

  /**
   * Refresh the current session
   */
  async refreshSession(): Promise<void> {
    if (!this.session?.refresh_token) {
      throw new Error('No refresh token');
    }

    const result = await this.callAuthEndpoint('refresh', {
      refresh_token: this.session.refresh_token
    });
    
    if (!result.access_token) {
      throw new Error('Refresh failed');
    }
    
    // Update session with new tokens (token rotation)
    this.session.access_token = result.access_token;
    if (result.refresh_token) {
      this.session.refresh_token = result.refresh_token;
    }
    this.session.expires_in = result.expires_in;
    this.session.expires_at = Date.now() + (result.expires_in * 1000);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.session));
    this.scheduleTokenRefresh();
    this.notifyListeners('TOKEN_REFRESHED', this.session);
  }

  /**
   * Set session manually (for SSR or custom flows)
   */
  setSession(session: CustomAuthSession): void {
    this.saveSession(session);
  }

  // ==========================================
  // USER METHODS
  // ==========================================

  /**
   * Get current user
   */
  async getUser(): Promise<AuthResponse<{ user: CustomAuthUser | null }>> {
    if (!this.session) {
      return { data: { user: null }, error: null };
    }

    try {
      const result = await this.callAuthEndpoint('get-user');
      
      // Update session with latest user data
      if (this.session && result.user) {
        this.session.user = result.user;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.session));
      }
      
      return { data: { user: result.user }, error: null };
    } catch (error: any) {
      return { data: { user: null }, error: { message: error.message } };
    }
  }

  /**
   * Update current user data
   */
  async updateUser(attributes: Partial<{ email: string; password: string; data: Record<string, any> }>): Promise<AuthResponse<{ user: CustomAuthUser }>> {
    try {
      const result = await this.callAuthEndpoint('update-user', attributes);
      
      if (this.session && result.user) {
        this.session.user = result.user;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.session));
        this.notifyListeners('USER_UPDATED', this.session);
      }
      
      return { data: { user: result.user }, error: null };
    } catch (error: any) {
      return { data: null, error: { message: error.message } };
    }
  }

  // ==========================================
  // PASSWORD METHODS
  // ==========================================

  /**
   * Request password reset email
   */
  async resetPasswordForEmail(email: string, options?: { redirectTo?: string }): Promise<AuthResponse<null>> {
    try {
      await this.callAuthEndpoint('request-password-reset', { 
        email,
        redirect_to: options?.redirectTo 
      });
      return { data: null, error: null };
    } catch (error: any) {
      return { data: null, error: { message: error.message } };
    }
  }

  /**
   * Update password with reset token
   */
  async updatePassword(newPassword: string, token?: string): Promise<AuthResponse<{ user: CustomAuthUser }>> {
    try {
      const result = await this.callAuthEndpoint('update-password', { 
        new_password: newPassword,
        token 
      });
      
      if (this.session && result.user) {
        this.session.user = result.user;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.session));
      }
      
      return { data: { user: result.user }, error: null };
    } catch (error: any) {
      return { data: null, error: { message: error.message } };
    }
  }

  // ==========================================
  // SESSION MANAGEMENT
  // ==========================================

  /**
   * Get all active sessions for current user
   */
  async getSessions(): Promise<AuthResponse<{ sessions: UserSession[] }>> {
    try {
      const result = await this.callAuthEndpoint('get-sessions');
      return { data: { sessions: result.sessions || [] }, error: null };
    } catch (error: any) {
      return { data: null, error: { message: error.message } };
    }
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(sessionId: string): Promise<AuthResponse<null>> {
    try {
      await this.callAuthEndpoint('revoke-session', { session_id: sessionId });
      return { data: null, error: null };
    } catch (error: any) {
      return { data: null, error: { message: error.message } };
    }
  }

  /**
   * Revoke all sessions except current
   */
  async revokeOtherSessions(): Promise<AuthResponse<null>> {
    try {
      await this.callAuthEndpoint('revoke-other-sessions');
      return { data: null, error: null };
    } catch (error: any) {
      return { data: null, error: { message: error.message } };
    }
  }

  // ==========================================
  // MFA METHODS
  // ==========================================

  /**
   * Enroll in MFA (TOTP)
   */
  async enrollMFA(): Promise<AuthResponse<{ secret: string; qr_code: string }>> {
    try {
      const result = await this.callAuthEndpoint('enroll-mfa');
      return { data: { secret: result.secret, qr_code: result.qr_code }, error: null };
    } catch (error: any) {
      return { data: null, error: { message: error.message } };
    }
  }

  /**
   * Verify MFA enrollment
   */
  async verifyMFAEnrollment(code: string): Promise<AuthResponse<null>> {
    try {
      await this.callAuthEndpoint('verify-mfa-enrollment', { code });
      
      if (this.session) {
        this.session.user.mfa_enabled = true;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.session));
      }
      
      return { data: null, error: null };
    } catch (error: any) {
      return { data: null, error: { message: error.message } };
    }
  }

  /**
   * Disable MFA
   */
  async disableMFA(code: string): Promise<AuthResponse<null>> {
    try {
      await this.callAuthEndpoint('disable-mfa', { code });
      
      if (this.session) {
        this.session.user.mfa_enabled = false;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.session));
      }
      
      return { data: null, error: null };
    } catch (error: any) {
      return { data: null, error: { message: error.message } };
    }
  }

  // ==========================================
  // EMAIL VERIFICATION
  // ==========================================

  /**
   * Resend verification email
   */
  async resendVerificationEmail(email: string): Promise<AuthResponse<null>> {
    try {
      await this.callAuthEndpoint('resend-verification', { email });
      return { data: null, error: null };
    } catch (error: any) {
      return { data: null, error: { message: error.message } };
    }
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<AuthResponse<{ user: CustomAuthUser }>> {
    try {
      const result = await this.callAuthEndpoint('verify-email', { token });
      return { data: { user: result.user }, error: null };
    } catch (error: any) {
      return { data: null, error: { message: error.message } };
    }
  }

  // ==========================================
  // AUTH STATE LISTENER
  // ==========================================

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChange(callback: AuthStateChangeCallback): { data: { subscription: { unsubscribe: () => void } } } {
    this.listeners.push(callback);
    
    // Immediately notify with current state
    if (this.session) {
      setTimeout(() => callback('INITIAL_SESSION', this.session), 0);
    }
    
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            this.listeners = this.listeners.filter(l => l !== callback);
          }
        }
      }
    };
  }

  // ==========================================
  // UTILITY GETTERS
  // ==========================================

  /**
   * Get current session synchronously
   */
  get currentSession(): CustomAuthSession | null {
    return this.session;
  }

  /**
   * Get current user synchronously
   */
  get currentUser(): CustomAuthUser | null {
    return this.session?.user || null;
  }

  /**
   * Get access token synchronously
   */
  get accessToken(): string | null {
    return this.session?.access_token || null;
  }

  /**
   * Check if user is authenticated
   */
  get isAuthenticated(): boolean {
    return !!this.session && this.session.expires_at > Date.now();
  }
}

// Export singleton instance
export const customAuthService = new CustomAuthService();

// Export for compatibility with existing code
export default customAuthService;
