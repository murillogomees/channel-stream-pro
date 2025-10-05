import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { parseM3U, type Channel } from '@/utils/m3uParser';
import { toast } from 'sonner';

export function useChannels(subscriptionPlanId?: string) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!subscriptionPlanId) {
      setLoading(false);
      return;
    }

    loadChannels();
  }, [subscriptionPlanId]);

  const loadChannels = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get subscription plan
      const { data: plan, error: planError } = await supabase
        .from('subscription_plans')
        .select('m3u_list_id')
        .eq('id', subscriptionPlanId)
        .single();

      if (planError) throw planError;
      if (!plan?.m3u_list_id) {
        throw new Error('Nenhuma lista M3U associada ao plano');
      }

      // Get M3U list
      const { data: m3uList, error: m3uError } = await supabase
        .from('m3u_lists')
        .select('file_url, name')
        .eq('id', plan.m3u_list_id)
        .eq('status', 'active')
        .single();

      if (m3uError) throw m3uError;
      if (!m3uList) {
        throw new Error('Lista M3U não encontrada');
      }

      // Download and parse M3U
      const { data: fileData, error: downloadError } = await supabase
        .storage
        .from('m3u-files')
        .download(m3uList.file_url);

      if (downloadError) throw downloadError;

      const content = await fileData.text();
      const playlist = parseM3U(content);

      setChannels(playlist.channels);
      setCategories(playlist.categories);
      
      toast.success(`${playlist.channels.length} canais carregados`);
    } catch (err: any) {
      console.error('Error loading channels:', err);
      setError(err.message);
      toast.error('Erro ao carregar canais');
    } finally {
      setLoading(false);
    }
  };

  const filteredChannels = selectedCategory === 'all'
    ? channels
    : channels.filter(ch => ch.category === selectedCategory);

  return {
    channels: filteredChannels,
    allChannels: channels,
    categories,
    selectedCategory,
    setSelectedCategory,
    loading,
    error,
    reload: loadChannels,
  };
}
