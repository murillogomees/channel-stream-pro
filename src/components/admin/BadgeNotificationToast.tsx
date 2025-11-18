import { useEffect } from 'react';
import { toast } from 'sonner';
import { Edit, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export function BadgeNotificationToast() {
  useEffect(() => {
    const channel = supabase
      .channel('m3u_list_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'm3u_lists',
        },
        async (payload) => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const { data: favorite } = await supabase
            .from('m3u_list_favorites')
            .select('id')
            .eq('admin_id', user.id)
            .eq('m3u_list_id', payload.new.id)
            .maybeSingle();

          if (!favorite) return;

          const oldList = payload.old;
          const newList = payload.new;

          if (oldList.status === 'active' && newList.status === 'inactive') {
            toast.error('Lista M3U Favorita Desativada', {
              description: `A lista "${newList.name}" foi desativada.`,
              icon: <XCircle className="h-4 w-4" />,
              duration: 5000,
            });
          } else if (
            oldList.name !== newList.name ||
            oldList.description !== newList.description ||
            oldList.file_url !== newList.file_url
          ) {
            toast.info('Lista M3U Favorita Editada', {
              description: `A lista "${newList.name}" foi atualizada.`,
              icon: <Edit className="h-4 w-4" />,
              duration: 4000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
