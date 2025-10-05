import { useState, useEffect, useCallback } from 'react';
import {
  verifyPassword,
  generateSessionToken,
  saveSession,
  loadSession,
  clearSession,
  isSessionValid,
  updateSessionActivity,
  checkRateLimit,
  recordLoginAttempt,
  type SessionData,
} from '@/lib/auth';

// Importa dados dos administradores
import adminsData from '@/data/admins.json';

export interface Admin {
  id: string;
  nome: string;
  email: string;
  passwordHash: string;
  dataCriacao: string;
  ativo: boolean;
}

export const useLocalAuth = () => {
  const [currentUser, setCurrentUser] = useState<Admin | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Verifica autenticação ao carregar
  const checkAuth = useCallback(() => {
    const session = loadSession();
    
    if (isSessionValid(session)) {
      // Atualiza atividade
      updateSessionActivity(session!);
      
      // Busca dados do admin
      const admin = adminsData.find(a => a.id === session!.userId && a.ativo);
      if (admin) {
        setCurrentUser(admin);
        setIsAuthenticated(true);
      } else {
        clearSession();
        setCurrentUser(null);
        setIsAuthenticated(false);
      }
    } else {
      setCurrentUser(null);
      setIsAuthenticated(false);
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    checkAuth();
    
    // Verifica sessão a cada minuto
    const interval = setInterval(() => {
      const session = loadSession();
      if (!isSessionValid(session)) {
        setCurrentUser(null);
        setIsAuthenticated(false);
      } else {
        updateSessionActivity(session!);
      }
    }, 60000); // 1 minuto
    
    return () => clearInterval(interval);
  }, [checkAuth]);

  // Login com validações de segurança
  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // Verifica rate limiting
      const rateLimitCheck = checkRateLimit();
      if (!rateLimitCheck.allowed) {
        return { success: false, error: rateLimitCheck.message };
      }

      // Valida e sanitiza inputs
      const { sanitizeInput, validateEmail, validatePassword } = await import('@/lib/auth');
      
      const sanitizedEmail = sanitizeInput(email);
      
      if (!validateEmail(sanitizedEmail)) {
        recordLoginAttempt(false, sanitizedEmail);
        return { success: false, error: 'Email inválido.' };
      }

      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        recordLoginAttempt(false, sanitizedEmail);
        return { success: false, error: passwordValidation.error };
      }

      // Busca admin por email
      const admin = adminsData.find(a => a.email.toLowerCase() === sanitizedEmail.toLowerCase());
      
      if (!admin) {
        recordLoginAttempt(false, sanitizedEmail);
        return { success: false, error: 'Credenciais inválidas.' };
      }

      // Verifica se está ativo
      if (!admin.ativo) {
        recordLoginAttempt(false, sanitizedEmail);
        return { success: false, error: 'Usuário inativo.' };
      }

      // Verifica senha
      const passwordValid = await verifyPassword(password, admin.passwordHash);
      if (!passwordValid) {
        recordLoginAttempt(false, sanitizedEmail);
        return { success: false, error: 'Credenciais inválidas.' };
      }

      // Cria sessão segura
      const now = Date.now();
      const session: SessionData = {
        token: generateSessionToken(),
        userId: admin.id,
        email: admin.email,
        nome: admin.nome,
        expiresAt: now + (8 * 60 * 60 * 1000), // 8 horas (reduzido para maior segurança)
        lastActivity: now,
      };

      saveSession(session);
      recordLoginAttempt(true, sanitizedEmail);
      
      setCurrentUser(admin);
      setIsAuthenticated(true);

      return { success: true };
    } catch (error) {
      // Não expõe detalhes do erro
      return { success: false, error: 'Erro ao processar login.' };
    }
  };

  // Logout
  const logout = () => {
    clearSession();
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  return {
    currentUser,
    isAuthenticated,
    loading,
    login,
    logout,
    checkAuth,
  };
};
