/**
 * AuthCacheService - Cache singleton para dados de autenticação
 * Elimina chamadas redundantes a supabase.auth.getUser() e getSession()
 */

import { Session } from '@supabase/supabase-js';
import { UnifiedUser } from '@/types/auth';

class AuthCacheService {
  private session: Session | null = null;
  private user: UnifiedUser | null = null;

  /**
   * Atualiza o cache com os dados atuais de auth
   * Chamado pelo AuthContext sempre que o estado muda
   */
  setAuthState(user: UnifiedUser | null, session: Session | null): void {
    this.user = user;
    this.session = session;
  }

  /**
   * Obtém a sessão cached (sem network request)
   */
  getSession(): Session | null {
    return this.session;
  }

  /**
   * Obtém o usuário cached (sem network request)
   */
  getUser(): UnifiedUser | null {
    return this.user;
  }

  /**
   * Obtém o ID do usuário (sem network request)
   */
  getUserId(): string | null {
    return this.user?.id || this.session?.user?.id || null;
  }

  /**
   * Obtém o access token para chamadas autenticadas
   */
  getAccessToken(): string | null {
    return this.session?.access_token || null;
  }

  /**
   * Verifica se há um usuário autenticado
   */
  isAuthenticated(): boolean {
    return !!this.session?.user;
  }

  /**
   * Limpa o cache (chamado no logout)
   */
  clear(): void {
    this.user = null;
    this.session = null;
  }
}

export const authCache = new AuthCacheService();
