import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Hook para ativar services pesados apenas em rotas admin
 * Evita overhead desnecessário em páginas públicas
 */
export function useConditionalServices() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin') || location.pathname === '/dashboard';

  useEffect(() => {
    // Só ativa services pesados em rotas admin
    if (!isAdminRoute) {
      return;
    }

    // Services são lazy-loaded e só iniciam quando necessário
    console.log('🔧 Services habilitados para rota admin:', location.pathname);

    return () => {
      console.log('🛑 Services desabilitados ao sair da rota admin');
    };
  }, [isAdminRoute, location.pathname]);

  return { isAdminRoute };
}
