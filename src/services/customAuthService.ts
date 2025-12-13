/**
 * Custom Auth Service - Now uses Supabase GoTrue Native
 * @version 6.0.0
 * 
 * Wrapper around Supabase Auth for backwards compatibility
 */

import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';

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

/**
 * Convert Supabase User to CustomAuthUser
 */
async function convertUser(user: User): Promise<CustomAuthUser> {
  // Fetch ALL roles from database
  const { data: rolesData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);
  
  // Priority: master > admin > client
  const allRoles = (rolesData || []).map(r => r.role);
  let role = 'client';
  if (allRoles.includes('master')) {
    role = 'master';
  } else if (allRoles.includes('admin')) {
    role = 'admin';
  } else if (allRoles.includes('client')) {
    role = 'client';
  }

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return {
    id: user.id,
    email: user.email || '',
    role,
    email_confirmed_at: user.email_confirmed_at,
    phone: user.phone,
    phone_confirmed_at: user.phone_confirmed_at,
    user_metadata: user.user_metadata,
    app_metadata: user.app_metadata,
    profile,
    last_sign_in_at: user.last_sign_in_at,
    created_at: user.created_at,
  };
}

/**
 * Convert Supabase Session to CustomAuthSession
 */
async function convertSession(session: Session): Promise<CustomAuthSession> {
  const customUser = await convertUser(session.user);
  
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token || '',
    token_type: session.token_type || 'bearer',
    expires_in: session.expires_in || 3600,
    expires_at: session.expires_at || (Date.now() / 1000 + 3600),
    user: customUser,
  };
}

class CustomAuthService {
  private listeners: AuthStateChangeCallback[] = [];

  constructor() {
    // Listen to Supabase auth changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      let customEvent: AuthEvent = 'SIGNED_OUT';
      let customSession: CustomAuthSession | null = null;

      if (session) {
        customSession = await convertSession(session);
        
        switch (event) {
          case 'SIGNED_IN':
            customEvent = 'SIGNED_IN';
            break;
          case 'SIGNED_OUT':
            customEvent = 'SIGNED_OUT';
            break;
          case 'TOKEN_REFRESHED':
            customEvent = 'TOKEN_REFRESHED';
            break;
          case 'USER_UPDATED':
            customEvent = 'USER_UPDATED';
            break;
          case 'PASSWORD_RECOVERY':
            customEvent = 'PASSWORD_RECOVERY';
            break;
          case 'INITIAL_SESSION':
            customEvent = 'INITIAL_SESSION';
            break;
        }
      }

      this.notifyListeners(customEvent, customSession);
    });
  }

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
   * Sign in with email and password
   */
  async signIn(email: string, password: string): Promise<AuthResponse<{ session: CustomAuthSession; user: CustomAuthUser }>> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        return { data: null, error: { message: error.message, code: error.code } };
      }
      
      if (!data.session) {
        return { data: null, error: { message: 'No session returned' } };
      }

      const customSession = await convertSession(data.session);
      return { data: { session: customSession, user: customSession.user }, error: null };
    } catch (error: any) {
      return { data: null, error: { message: error.message || 'Sign in failed' } };
    }
  }

  /**
   * Sign up with email and password
   */
  async signUp(email: string, password: string, userData?: Record<string, any>): Promise<AuthResponse<{ session: CustomAuthSession; user: CustomAuthUser }>> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: userData,
          emailRedirectTo: `${window.location.origin}/`,
        },
      });
      
      if (error) {
        return { data: null, error: { message: error.message, code: error.code } };
      }
      
      if (!data.session) {
        // Email confirmation required
        return { 
          data: null, 
          error: { message: 'Verifique seu email para confirmar o cadastro', code: 'EMAIL_CONFIRMATION_REQUIRED' } 
        };
      }

      const customSession = await convertSession(data.session);
      return { data: { session: customSession, user: customSession.user }, error: null };
    } catch (error: any) {
      return { data: null, error: { message: error.message || 'Sign up failed' } };
    }
  }

  /**
   * Sign out current user
   */
  async signOut(): Promise<AuthResponse<null>> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        return { data: null, error: { message: error.message } };
      }
      return { data: null, error: null };
    } catch (error: any) {
      return { data: null, error: { message: error.message } };
    }
  }

  /**
   * Get current session
   */
  async getSession(): Promise<AuthResponse<{ session: CustomAuthSession | null }>> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        return { data: { session: null }, error: { message: error.message } };
      }
      
      if (!session) {
        return { data: { session: null }, error: null };
      }

      const customSession = await convertSession(session);
      return { data: { session: customSession }, error: null };
    } catch (error: any) {
      return { data: { session: null }, error: { message: error.message } };
    }
  }

  /**
   * Get current user
   */
  async getUser(): Promise<AuthResponse<{ user: CustomAuthUser | null }>> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        return { data: { user: null }, error: error ? { message: error.message } : null };
      }

      const customUser = await convertUser(user);
      return { data: { user: customUser }, error: null };
    } catch (error: any) {
      return { data: { user: null }, error: { message: error.message } };
    }
  }

  /**
   * Reset password for email
   */
  async resetPasswordForEmail(email: string, options?: { redirectTo?: string }): Promise<AuthResponse<null>> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: options?.redirectTo || `${window.location.origin}/reset-password`,
      });
      
      if (error) {
        return { data: null, error: { message: error.message } };
      }
      return { data: null, error: null };
    } catch (error: any) {
      return { data: null, error: { message: error.message } };
    }
  }

  /**
   * Update user password
   */
  async updatePassword(newPassword: string): Promise<AuthResponse<null>> {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      
      if (error) {
        return { data: null, error: { message: error.message } };
      }
      return { data: null, error: null };
    } catch (error: any) {
      return { data: null, error: { message: error.message } };
    }
  }

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChange(callback: AuthStateChangeCallback) {
    this.listeners.push(callback);
    
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            const index = this.listeners.indexOf(callback);
            if (index > -1) {
              this.listeners.splice(index, 1);
            }
          }
        }
      }
    };
  }

  /**
   * Get active sessions (simplified - returns empty for Cloud)
   */
  async getSessions(): Promise<AuthResponse<{ sessions: UserSession[] }>> {
    return { data: { sessions: [] }, error: null };
  }

  /**
   * Revoke session (no-op for Cloud)
   */
  async revokeSession(): Promise<AuthResponse<null>> {
    return { data: null, error: null };
  }

  /**
   * Update user data
   */
  async updateUser(data: { password?: string; email?: string }): Promise<AuthResponse<null>> {
    try {
      const { error } = await supabase.auth.updateUser(data);
      if (error) {
        return { data: null, error: { message: error.message } };
      }
      return { data: null, error: null };
    } catch (error: any) {
      return { data: null, error: { message: error.message } };
    }
  }
}

export const customAuthService = new CustomAuthService();
