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

  // Login
  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // Verifica rate limiting
      const rateLimitCheck = checkRateLimit();
      if (!rateLimitCheck.allowed) {
        return { success: false, error: rateLimitCheck.message };
      }

      // Busca admin por email
      const admin = adminsData.find(a => a.email.toLowerCase() === email.toLowerCase().trim());
      
      if (!admin) {
        recordLoginAttempt(false);
        return { success: false, error: 'Credenciais inválidas.' };
      }

      // Verifica se está ativo
      if (!admin.ativo) {
        recordLoginAttempt(false);
        return { success: false, error: 'Usuário inativo.' };
      }

      // Verifica senha
      const passwordValid = await verifyPassword(password, admin.passwordHash);
      if (!passwordValid) {
        recordLoginAttempt(false);
        return { success: false, error: 'Credenciais inválidas.' };
      }

      // Cria sessão
      const now = Date.now();
      const session: SessionData = {
        token: generateSessionToken(),
        userId: admin.id,
        email: admin.email,
        nome: admin.nome,
        expiresAt: now + (24 * 60 * 60 * 1000), // 24 horas
        lastActivity: now,
      };

      saveSession(session);
      recordLoginAttempt(true);
      
      setCurrentUser(admin);
      setIsAuthenticated(true);

      return { success: true };
    } catch (error) {
      console.error('Erro no login:', error);
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
