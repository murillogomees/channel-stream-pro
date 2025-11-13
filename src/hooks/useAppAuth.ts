import { useState, useEffect, useCallback } from 'react';
import { useClientes } from './useClientes';

export interface AppSession {
  type: 'client' | 'admin';
  clienteId?: string;
  nome?: string;
  mac?: string;
  m3uUrl?: string;
  expiresAt?: string;
  email?: string;
}

export function useAppAuth() {
  const { clientes } = useClientes();
  const [session, setSession] = useState<AppSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      const sessionData = localStorage.getItem('app_session');
      
      if (!sessionData) {
        setSession(null);
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      const parsedSession: AppSession = JSON.parse(sessionData);

      // Se for admin, permitir acesso sempre
      if (parsedSession.type === 'admin') {
        setSession(parsedSession);
        setIsAuthenticated(true);
        setIsLoading(false);
        return;
      }

      // Se for cliente, verificar status e vencimento
      if (parsedSession.type === 'client' && parsedSession.mac) {
        // Buscar dados atualizados do cliente
        const cliente = clientes.find(c => 
          c.macSmartOne?.toUpperCase() === parsedSession.mac?.toUpperCase()
        );

        if (!cliente) {
          // Cliente não encontrado
          localStorage.removeItem('app_session');
          setSession(null);
          setIsAuthenticated(false);
          setIsLoading(false);
          return;
        }

        // Verificar se cliente está ativo
        if (!cliente.clienteAtivo) {
          localStorage.removeItem('app_session');
          setSession(null);
          setIsAuthenticated(false);
          setIsLoading(false);
          return;
        }

        // Verificar vencimento
        const dataVencimento = new Date(cliente.dataVencimento);
        const hoje = new Date();
        
        if (dataVencimento < hoje) {
          // Assinatura vencida
          localStorage.removeItem('app_session');
          setSession(null);
          setIsAuthenticated(false);
          setIsLoading(false);
          return;
        }

        // Atualizar sessão com dados atualizados
        const updatedSession: AppSession = {
          type: 'client',
          clienteId: cliente.id,
          nome: cliente.nome,
          mac: cliente.macSmartOne,
          m3uUrl: cliente.usuario, // URL da playlist
          expiresAt: cliente.dataVencimento,
        };

        localStorage.setItem('app_session', JSON.stringify(updatedSession));
        setSession(updatedSession);
        setIsAuthenticated(true);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Erro ao verificar autenticação:', error);
      localStorage.removeItem('app_session');
      setSession(null);
      setIsAuthenticated(false);
      setIsLoading(false);
    }
  }, [clientes]);

  const logout = useCallback(() => {
    localStorage.removeItem('app_session');
    setSession(null);
    setIsAuthenticated(false);
  }, []);

  // Verificar autenticação ao montar
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Verificar status periodicamente (a cada 5 minutos)
  useEffect(() => {
    if (!session || session.type === 'admin') return;

    const interval = setInterval(() => {
      checkAuth();
    }, 5 * 60 * 1000); // 5 minutos

    return () => clearInterval(interval);
  }, [session, checkAuth]);

  return {
    session,
    isAuthenticated,
    isLoading,
    checkAuth,
    logout
  };
}
