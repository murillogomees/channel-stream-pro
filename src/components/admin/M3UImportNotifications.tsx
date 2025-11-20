import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Bell, CheckCircle, XCircle } from 'lucide-react';

/**
 * Componente para monitorar e notificar sobre importações M3U
 */
export function M3UImportNotifications() {
  useEffect(() => {
    // Subscrever a mudanças nas sessões de importação
    const channel = supabase
      .channel('m3u-import-notifications')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'm3u_import_sessions',
          filter: 'status=eq.completed'
        },
        (payload) => {
          const session = payload.new;
          
          // Notificação de sucesso
          toast.success('Importação M3U Concluída!', {
            description: `${session.total_channels || 0} canais importados com sucesso`,
            icon: <CheckCircle className="h-4 w-4" />,
            duration: 5000,
          });

          // Notificação de desktop se permitido
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Importação M3U Concluída', {
              body: `${session.total_channels || 0} canais importados com sucesso`,
              icon: '/logo.png',
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'm3u_import_sessions',
          filter: 'status=eq.failed'
        },
        (payload) => {
          const session = payload.new;
          
          // Notificação de erro
          toast.error('Importação M3U Falhou', {
            description: session.error_message || 'Erro desconhecido durante a importação',
            icon: <XCircle className="h-4 w-4" />,
            duration: 7000,
          });

          // Notificação de desktop se permitido
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Importação M3U Falhou', {
              body: session.error_message || 'Erro durante a importação',
              icon: '/logo.png',
            });
          }
        }
      )
      .subscribe();

    // Solicitar permissão para notificações desktop
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      channel.unsubscribe();
    };
  }, []);

  return null; // Componente não renderiza nada
}
