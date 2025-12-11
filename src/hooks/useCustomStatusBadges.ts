import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

export interface CustomStatusBadge {
  id: string;
  name: string;
  label: string;
  description: string | null;
  color: string;
  icon_name: string | null;
  is_critical: boolean;
  created_at: string;
  updated_at: string;
}

export function useCustomStatusBadges() {
  const [badges, setBadges] = useState<CustomStatusBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchBadges = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('custom_status_badges')
        .select('*')
        .order('label');

      if (error) throw error;
      setBadges((data || []).map(b => ({
        id: b.id,
        name: b.label,
        label: b.label,
        description: b.description,
        color: b.color,
        icon_name: b.icon,
        is_critical: false,
        created_at: b.created_at,
        updated_at: b.created_at,
      })));
    } catch (error: any) {
      console.error('Erro ao carregar badges:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os badges personalizados',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createBadge = async (badge: Omit<CustomStatusBadge, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { error } = await supabase
        .from('custom_status_badges')
        .insert({
          status_key: badge.name.toLowerCase().replace(/\s+/g, '_'),
          label: badge.label || badge.name,
          description: badge.description,
          color: badge.color,
          icon: badge.icon_name,
          is_active: true,
        });

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Badge personalizado criado com sucesso',
      });

      await fetchBadges();
      return true;
    } catch (error: any) {
      console.error('Erro ao criar badge:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível criar o badge',
        variant: 'destructive',
      });
      return false;
    }
  };

  const updateBadge = async (id: string, updates: Partial<CustomStatusBadge>) => {
    try {
      const { error } = await supabase
        .from('custom_status_badges')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Badge atualizado com sucesso',
      });

      await fetchBadges();
      return true;
    } catch (error: any) {
      console.error('Erro ao atualizar badge:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível atualizar o badge',
        variant: 'destructive',
      });
      return false;
    }
  };

  const deleteBadge = async (id: string) => {
    try {
      const { error } = await supabase
        .from('custom_status_badges')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Badge deletado com sucesso',
      });

      await fetchBadges();
      return true;
    } catch (error: any) {
      console.error('Erro ao deletar badge:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível deletar o badge',
        variant: 'destructive',
      });
      return false;
    }
  };

  useEffect(() => {
    fetchBadges();
  }, []);

  return {
    badges,
    loading,
    createBadge,
    updateBadge,
    deleteBadge,
    refetch: fetchBadges,
  };
}
