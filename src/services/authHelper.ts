/**
 * Auth Helper - Substitui supabase.auth completamente
 * @version 1.0.0
 * 
 * Fornece uma API compatível com supabase.auth mas usa Custom Auth internamente.
 * Elimina toda dependência de GoTrue.
 */

import { customAuthService, CustomAuthSession, CustomAuthUser } from './customAuthService';
import { authCache } from './authCacheService';

export interface AuthHelperSession {
  access_token: string;
  refresh_token: string;
  user: AuthHelperUser;
}

export interface AuthHelperUser {
  id: string;
  email: string;
  role: string;
  email_confirmed_at?: string;
  phone?: string;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
}

/**
 * Auth Helper - Drop-in replacement for supabase.auth
 */
class AuthHelper {
  /**
   * Get current session - compatível com supabase.auth.getSession()
   */
  async getSession(): Promise<{ data: { session: AuthHelperSession | null }; error: any }> {
    try {
      const result = await customAuthService.getSession();
      
      if (!result.data?.session) {
        return { data: { session: null }, error: null };
      }

      const session = result.data.session;
      return {
        data: {
          session: {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            user: {
              id: session.user.id,
              email: session.user.email,
              role: session.user.role,
              email_confirmed_at: session.user.email_confirmed_at,
              phone: session.user.phone,
              user_metadata: session.user.user_metadata,
              app_metadata: session.user.app_metadata,
            }
          }
        },
        error: null
      };
    } catch (error: any) {
      return { data: { session: null }, error };
    }
  }

  /**
   * Get current user - compatível com supabase.auth.getUser()
   */
  async getUser(): Promise<{ data: { user: AuthHelperUser | null }; error: any }> {
    try {
      // Tentar cache primeiro
      const cachedUser = authCache.getUser();
      if (cachedUser) {
        return {
          data: {
            user: {
              id: cachedUser.id,
              email: cachedUser.email,
              role: cachedUser.roles?.[0] || 'client',
              phone: cachedUser.telefone,
            }
          },
          error: null
        };
      }

      const result = await customAuthService.getUser();
      
      if (!result.data?.user) {
        return { data: { user: null }, error: null };
      }

      const user = result.data.user;
      return {
        data: {
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            email_confirmed_at: user.email_confirmed_at,
            phone: user.phone,
            user_metadata: user.user_metadata,
            app_metadata: user.app_metadata,
          }
        },
        error: null
      };
    } catch (error: any) {
      return { data: { user: null }, error };
    }
  }

  /**
   * Get access token diretamente
   */
  getAccessToken(): string | null {
    return authCache.getAccessToken();
  }

  /**
   * Get user ID diretamente (sem network request)
   */
  getUserId(): string | null {
    return authCache.getUserId();
  }

  /**
   * Check if authenticated (sync)
   */
  isAuthenticated(): boolean {
    return authCache.isAuthenticated();
  }

  /**
   * Sign out - compatível com supabase.auth.signOut()
   */
  async signOut(): Promise<{ error: any }> {
    try {
      await customAuthService.signOut();
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  }

  /**
   * Update user - compatível com supabase.auth.updateUser()
   */
  async updateUser(attributes: { password?: string; data?: Record<string, any> }): Promise<{ data: { user: AuthHelperUser | null }; error: any }> {
    try {
      const result = await customAuthService.updateUser(attributes);
      
      if (result.error) {
        return { data: { user: null }, error: result.error };
      }

      if (!result.data?.user) {
        return { data: { user: null }, error: null };
      }

      const user = result.data.user;
      return {
        data: {
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            email_confirmed_at: user.email_confirmed_at,
            phone: user.phone,
            user_metadata: user.user_metadata,
            app_metadata: user.app_metadata,
          }
        },
        error: null
      };
    } catch (error: any) {
      return { data: { user: null }, error };
    }
  }

  /**
   * Listener para mudanças de auth (compatível com supabase.auth.onAuthStateChange)
   */
  onAuthStateChange(callback: (event: string, session: AuthHelperSession | null) => void): { data: { subscription: { unsubscribe: () => void } } } {
    const subscription = customAuthService.onAuthStateChange((event, session) => {
      const helperSession = session ? {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        user: {
          id: session.user.id,
          email: session.user.email,
          role: session.user.role,
          email_confirmed_at: session.user.email_confirmed_at,
          phone: session.user.phone,
          user_metadata: session.user.user_metadata,
          app_metadata: session.user.app_metadata,
        }
      } : null;
      
      callback(event, helperSession);
    });

    return subscription;
  }
}

export const authHelper = new AuthHelper();

// Função helper para obter token de autorização para Edge Functions
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = authCache.getAccessToken();
  
  if (token) {
    return {
      'Authorization': `Bearer ${token}`,
      'X-Custom-Token': token,
    };
  }

  // Fallback: tentar buscar sessão
  const { data } = await customAuthService.getSession();
  if (data?.session?.access_token) {
    return {
      'Authorization': `Bearer ${data.session.access_token}`,
      'X-Custom-Token': data.session.access_token,
    };
  }

  return {};
}

// Função helper para verificar autenticação antes de operações
export async function requireAuth(): Promise<{ userId: string; token: string }> {
  const userId = authCache.getUserId();
  const token = authCache.getAccessToken();

  if (!userId || !token) {
    throw new Error('User not authenticated');
  }

  return { userId, token };
}
