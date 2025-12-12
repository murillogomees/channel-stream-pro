/**
 * Custom Auth Service - Bypasses GoTrue completely
 * Uses direct database authentication via Edge Function
 */

// Self-hosted Supabase - Primary instance
const SUPABASE_URL = 'https://supabase.iptvlink.com.br';
const SUPABASE_ANON_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NTIyMDgyMCwiZXhwIjo0OTIwODk0NDIwLCJyb2xlIjoiYW5vbiJ9.55tQdiEEa0mlCvveFpQZwMHqDZt0DzAgUQOPpLCNDLU';

const STORAGE_KEY = 'custom_auth_session';

export interface CustomAuthUser {
  id: string;
  email: string;
  role: string;
  email_confirmed_at?: string;
  user_metadata?: Record<string, any>;
  profile?: Record<string, any>;
}

export interface CustomAuthSession {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  expires_at: number;
  user: CustomAuthUser;
}

type AuthStateChangeCallback = (event: string, session: CustomAuthSession | null) => void;

class CustomAuthService {
  private session: CustomAuthSession | null = null;
  private listeners: AuthStateChangeCallback[] = [];

  constructor() {
    this.loadSession();
  }

  private loadSession(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const session = JSON.parse(stored) as CustomAuthSession;
        // Check if token is expired
        if (session.expires_at > Date.now()) {
          this.session = session;
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch (e) {
      console.error('Error loading session:', e);
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  private saveSession(session: CustomAuthSession): void {
    session.expires_at = Date.now() + (session.expires_in * 1000);
    this.session = session;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    this.notifyListeners('SIGNED_IN', session);
  }

  private clearSession(): void {
    this.session = null;
    localStorage.removeItem(STORAGE_KEY);
    this.notifyListeners('SIGNED_OUT', null);
  }

  private notifyListeners(event: string, session: CustomAuthSession | null): void {
    this.listeners.forEach(callback => {
      try {
        callback(event, session);
      } catch (e) {
        console.error('Error in auth listener:', e);
      }
    });
  }

  private async callAuthEndpoint(action: string, data: Record<string, any> = {}): Promise<any> {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/custom-auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        ...(this.session?.access_token ? { 'Authorization': `Bearer ${this.session.access_token}` } : {})
      },
      body: JSON.stringify({ action, ...data })
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Authentication failed');
    }
    
    return result;
  }

  async signIn(email: string, password: string): Promise<{ data: { session: CustomAuthSession; user: CustomAuthUser } | null; error: Error | null }> {
    try {
      const result = await this.callAuthEndpoint('login', { email, password });
      
      const session: CustomAuthSession = {
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        token_type: result.token_type,
        expires_in: result.expires_in,
        expires_at: Date.now() + (result.expires_in * 1000),
        user: result.user
      };
      
      this.saveSession(session);
      
      return { data: { session, user: result.user }, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }

  async signUp(email: string, password: string, userData?: Record<string, any>): Promise<{ data: { session: CustomAuthSession; user: CustomAuthUser } | null; error: Error | null }> {
    try {
      const result = await this.callAuthEndpoint('signup', { email, password, userData });
      
      const session: CustomAuthSession = {
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        token_type: result.token_type,
        expires_in: result.expires_in,
        expires_at: Date.now() + (result.expires_in * 1000),
        user: result.user
      };
      
      this.saveSession(session);
      
      return { data: { session, user: result.user }, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }

  async signOut(): Promise<{ error: Error | null }> {
    try {
      await this.callAuthEndpoint('logout');
      this.clearSession();
      return { error: null };
    } catch (error: any) {
      this.clearSession(); // Clear anyway
      return { error };
    }
  }

  async getSession(): Promise<{ data: { session: CustomAuthSession | null }; error: Error | null }> {
    if (!this.session) {
      return { data: { session: null }, error: null };
    }

    // Check if token is expired
    if (this.session.expires_at <= Date.now()) {
      try {
        await this.refreshSession();
      } catch (e) {
        this.clearSession();
        return { data: { session: null }, error: null };
      }
    }

    return { data: { session: this.session }, error: null };
  }

  async getUser(): Promise<{ data: { user: CustomAuthUser | null }; error: Error | null }> {
    if (!this.session) {
      return { data: { user: null }, error: null };
    }

    try {
      const result = await this.callAuthEndpoint('get-user');
      
      // Update session with latest user data
      if (this.session) {
        this.session.user = result.user;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.session));
      }
      
      return { data: { user: result.user }, error: null };
    } catch (error: any) {
      return { data: { user: null }, error };
    }
  }

  async refreshSession(): Promise<void> {
    if (!this.session?.refresh_token) {
      throw new Error('No refresh token');
    }

    const result = await this.callAuthEndpoint('refresh');
    
    this.session.access_token = result.access_token;
    this.session.expires_in = result.expires_in;
    this.session.expires_at = Date.now() + (result.expires_in * 1000);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.session));
    this.notifyListeners('TOKEN_REFRESHED', this.session);
  }

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

  // Helper to get current session synchronously
  get currentSession(): CustomAuthSession | null {
    return this.session;
  }

  get currentUser(): CustomAuthUser | null {
    return this.session?.user || null;
  }
}

export const customAuthService = new CustomAuthService();
