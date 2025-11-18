import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface M3UTag {
  id: string;
  name: string;
  category: 'qualidade' | 'tipo' | 'regiao' | 'idioma';
  color?: string;
  created_at: string;
}

export interface M3UListTag {
  id: string;
  m3u_list_id: string;
  tag_id: string;
  tag?: M3UTag;
}

export function useM3UTags() {
  const [tags, setTags] = useState<M3UTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadTags = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('m3u_tags')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setTags((data as M3UTag[]) || []);
    } catch (error: any) {
      console.error('Error loading tags:', error);
      toast.error('Erro ao carregar tags', {
        description: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getTagsByCategory = (category: string) => {
    return tags.filter(tag => tag.category === category);
  };

  const getListTags = async (listId: string): Promise<M3UTag[]> => {
    try {
      const { data, error } = await supabase
        .from('m3u_list_tags')
        .select(`
          tag_id,
          m3u_tags (*)
        `)
        .eq('m3u_list_id', listId);

      if (error) throw error;
      
      return data?.map((item: any) => item.m3u_tags).filter(Boolean) || [];
    } catch (error: any) {
      console.error('Error loading list tags:', error);
      return [];
    }
  };

  const updateListTags = async (listId: string, tagIds: string[]) => {
    try {
      // Remover tags existentes
      await supabase
        .from('m3u_list_tags')
        .delete()
        .eq('m3u_list_id', listId);

      // Adicionar novas tags
      if (tagIds.length > 0) {
        const { error } = await supabase
          .from('m3u_list_tags')
          .insert(
            tagIds.map(tagId => ({
              m3u_list_id: listId,
              tag_id: tagId
            }))
          );

        if (error) throw error;
      }

      toast.success('Tags atualizadas com sucesso');
    } catch (error: any) {
      console.error('Error updating list tags:', error);
      toast.error('Erro ao atualizar tags', {
        description: error.message
      });
      throw error;
    }
  };

  const createTag = async (tag: Omit<M3UTag, 'id' | 'created_at'>) => {
    try {
      const { data, error } = await supabase
        .from('m3u_tags')
        .insert(tag)
        .select()
        .single();

      if (error) throw error;
      
      await loadTags();
      toast.success('Tag criada com sucesso');
      return data;
    } catch (error: any) {
      console.error('Error creating tag:', error);
      toast.error('Erro ao criar tag', {
        description: error.message
      });
      throw error;
    }
  };

  useEffect(() => {
    loadTags();
  }, []);

  return {
    tags,
    isLoading,
    loadTags,
    getTagsByCategory,
    getListTags,
    updateListTags,
    createTag
  };
}
