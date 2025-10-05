/**
 * Utilitários de autenticação local
 * Sistema 100% offline usando Web Crypto API
 * Com proteções de segurança
 */

// Constantes de segurança
const SALT_PREFIX = 'offline_auth_v1_';
const SESSION_ENCRYPTION_KEY = 'session_key_v1';

// Sanitiza entrada para prevenir XSS
export function sanitizeInput(input: string): string {
  if (!input) return '';
  return input
    .trim()
    .replace(/[<>'"]/g, '') // Remove caracteres perigosos
    .substring(0, 500); // Limite de tamanho
}

// Valida email
export function validateEmail(email: string): boolean {
  const sanitized = sanitizeInput(email);
  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(sanitized) && sanitized.length <= 255;
}

// Valida senha (mínimo de segurança)
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || password.length < 8) {
    return { valid: false, error: 'Senha deve ter no mínimo 8 caracteres' };
  }
  if (password.length > 128) {
    return { valid: false, error: 'Senha muito longa' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Senha deve conter ao menos uma letra maiúscula' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Senha deve conter ao menos uma letra minúscula' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Senha deve conter ao menos um número' };
  }
  return { valid: true };
}

// Gera hash SHA-256 de uma senha com salt
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const saltedPassword = SALT_PREFIX + password;
  const data = encoder.encode(saltedPassword);
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

// Criptografa dados sensíveis
function encryptData(data: string): string {
  // Simple XOR cipher para ofuscação básica
  const key = SESSION_ENCRYPTION_KEY;
  let encrypted = '';
  for (let i = 0; i < data.length; i++) {
    encrypted += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(encrypted);
}

// Descriptografa dados
function decryptData(encrypted: string): string | null {
  try {
    const key = SESSION_ENCRYPTION_KEY;
    const data = atob(encrypted);
    let decrypted = '';
    for (let i = 0; i < data.length; i++) {
      decrypted += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return decrypted;
  } catch {
    return null;
  }
}

// Salva sessão no sessionStorage de forma segura
export function saveSession(session: SessionData): void {
  const sessionStr = JSON.stringify(session);
  const encrypted = encryptData(sessionStr);
  sessionStorage.setItem('admin_session', encrypted);
}

// Carrega sessão do sessionStorage de forma segura
export function loadSession(): SessionData | null {
  const encrypted = sessionStorage.getItem('admin_session');
  if (!encrypted) return null;
  
  try {
    const decrypted = decryptData(encrypted);
    if (!decrypted) return null;
    
    const session = JSON.parse(decrypted) as SessionData;
    
    // Valida estrutura da sessão
    if (!session.token || !session.userId || !session.email) {
      clearSession();
      return null;
    }
    
    return session;
  } catch {
    clearSession();
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

export function recordLoginAttempt(success: boolean, email?: string): void {
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

// Previne timing attacks
export async function constantTimeCompare(a: string, b: string): Promise<boolean> {
  if (a.length !== b.length) {
    // Executa hash mesmo assim para manter tempo constante
    await hashPassword('dummy_password');
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}
