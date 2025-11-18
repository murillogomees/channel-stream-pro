import { supabase } from "@/integrations/supabase/client";

export interface M3UList {
  id: string;
  name: string;
  file_url: string;
  status: string;
  priority: number;
  is_default: boolean;
  created_at: string;
  description?: string;
}

/**
 * Serviço para gerenciar listas M3U
 * Nota: Todas as listas estão disponíveis para todos os clientes
 * A atribuição específica é feita no cadastro do cliente
 */
export const m3uPlanService = {
  /**
   * Obtém a lista M3U padrão ou a primeira lista ativa disponível
   */
  async getM3UForClient(): Promise<string | null> {
    try {
      // Buscar lista padrão ou primeira lista ativa
      const { data, error } = await supabase
        .from('m3u_lists')
        .select('file_url')
        .eq('status', 'active')
        .order('is_default', { ascending: false })
        .order('priority', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        console.error('Erro ao buscar lista M3U:', error);
        return null;
      }

      return data.file_url;
    } catch (error) {
      console.error('Erro ao obter lista M3U:', error);
      return null;
    }
  },

  /**
   * Lista todas as listas M3U ativas
   */
  async getAllLists(): Promise<M3UList[]> {
    const { data, error } = await supabase
      .from('m3u_lists')
      .select('*')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao listar M3U:', error);
      return [];
    }

    return (data || []) as M3UList[];
  },

  /**
   * Busca listas ativas
   */
  async getActiveLists(): Promise<M3UList[]> {
    const { data, error } = await supabase
      .from('m3u_lists')
      .select('*')
      .eq('status', 'active')
      .order('priority', { ascending: false });

    if (error) {
      console.error('Erro ao buscar listas ativas:', error);
      return [];
    }

    return (data || []) as M3UList[];
  },

  /**
   * Atualiza a prioridade de uma lista M3U
   */
  async updateListPriority(
    listId: string,
    priority: number
  ): Promise<boolean> {
    const { error } = await supabase
      .from('m3u_lists')
      .update({ priority })
      .eq('id', listId);

    if (error) {
      console.error('Erro ao atualizar prioridade da lista:', error);
      return false;
    }

    return true;
  },

  /**
   * Define lista como padrão
   */
  async setDefaultList(listId: string): Promise<boolean> {
    const { error } = await supabase
      .from('m3u_lists')
      .update({ is_default: true })
      .eq('id', listId);

    if (error) {
      console.error('Erro ao definir lista padrão:', error);
      return false;
    }

    return true;
  },

  /**
   * Busca lista por ID
   */
  async getListById(listId: string): Promise<M3UList | null> {
    const { data, error } = await supabase
      .from('m3u_lists')
      .select('*')
      .eq('id', listId)
      .single();

    if (error) {
      console.error('Erro ao buscar lista M3U:', error);
      return null;
    }

    return data as M3UList;
  },

  /**
   * Valida se uma URL M3U é acessível
   */
  async validateM3UUrl(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      console.error('Erro ao validar URL M3U:', error);
      return false;
    }
  }
};
