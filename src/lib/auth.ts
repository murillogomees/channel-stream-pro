/**
 * Utilitários de autenticação local
 * Sistema 100% offline usando Web Crypto API
 */

// Gera hash SHA-256 de uma senha
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Verifica se a senha corresponde ao hash
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

// Gera token único para sessão
export function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Estrutura da sessão
export interface SessionData {
  token: string;
  userId: string;
  email: string;
  nome: string;
  expiresAt: number;
  lastActivity: number;
}

// Salva sessão no sessionStorage
export function saveSession(session: SessionData): void {
  sessionStorage.setItem('admin_session', JSON.stringify(session));
}

// Carrega sessão do sessionStorage
export function loadSession(): SessionData | null {
  const sessionStr = sessionStorage.getItem('admin_session');
  if (!sessionStr) return null;
  
  try {
    const session = JSON.parse(sessionStr) as SessionData;
    return session;
  } catch {
    return null;
  }
}

// Remove sessão
export function clearSession(): void {
  sessionStorage.removeItem('admin_session');
  sessionStorage.removeItem('login_attempts');
}

// Valida se a sessão está ativa
export function isSessionValid(session: SessionData | null): boolean {
  if (!session) return false;
  
  const now = Date.now();
  const THIRTY_MINUTES = 30 * 60 * 1000;
  
  // Verifica se expirou (30 minutos de inatividade)
  if (now - session.lastActivity > THIRTY_MINUTES) {
    clearSession();
    return false;
  }
  
  // Verifica se está dentro do período de validade
  if (now > session.expiresAt) {
    clearSession();
    return false;
  }
  
  return true;
}

// Atualiza última atividade da sessão
export function updateSessionActivity(session: SessionData): void {
  session.lastActivity = Date.now();
  saveSession(session);
}

// Rate limiting para login
interface LoginAttempt {
  count: number;
  lastAttempt: number;
  blockedUntil?: number;
}

export function checkRateLimit(): { allowed: boolean; message?: string } {
  const attemptsStr = sessionStorage.getItem('login_attempts');
  const now = Date.now();
  
  let attempts: LoginAttempt = attemptsStr 
    ? JSON.parse(attemptsStr)
    : { count: 0, lastAttempt: now };
  
  // Se está bloqueado, verificar se já passou o tempo
  if (attempts.blockedUntil && now < attempts.blockedUntil) {
    const minutesLeft = Math.ceil((attempts.blockedUntil - now) / 60000);
    return { 
      allowed: false, 
      message: `Muitas tentativas. Tente novamente em ${minutesLeft} minuto(s).` 
    };
  }
  
  // Reset se passou mais de 15 minutos
  if (now - attempts.lastAttempt > 15 * 60 * 1000) {
    attempts = { count: 0, lastAttempt: now };
  }
  
  return { allowed: true };
}

export function recordLoginAttempt(success: boolean): void {
  const attemptsStr = sessionStorage.getItem('login_attempts');
  const now = Date.now();
  
  let attempts: LoginAttempt = attemptsStr 
    ? JSON.parse(attemptsStr)
    : { count: 0, lastAttempt: now };
  
  if (success) {
    // Limpa tentativas em caso de sucesso
    sessionStorage.removeItem('login_attempts');
    return;
  }
  
  // Incrementa tentativas
  attempts.count++;
  attempts.lastAttempt = now;
  
  // Bloqueia após 5 tentativas
  if (attempts.count >= 5) {
    attempts.blockedUntil = now + (15 * 60 * 1000); // 15 minutos
  }
  
  sessionStorage.setItem('login_attempts', JSON.stringify(attempts));
}
