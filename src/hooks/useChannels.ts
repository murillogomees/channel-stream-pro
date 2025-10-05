import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { parseM3U, type Channel } from '@/utils/m3uParser';
import { toast } from 'sonner';

export function useChannels(m3uUrl?: string) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!m3uUrl) {
      setLoading(false);
      return;
    }

    loadChannels();
  }, [m3uUrl]);

  const loadChannels = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!m3uUrl) {
        throw new Error('URL do M3U não fornecida');
      }

      // Download M3U from storage
      const { data: fileData, error: downloadError } = await supabase
        .storage
        .from('m3u-files')
        .download(m3uUrl);

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
