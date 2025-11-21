import { supabase } from "@/integrations/supabase/client";

export interface M3UList {
  id: string;
  name: string;
  file_url: string;
  status: string;
  is_default: boolean;
  created_at: string;
  description?: string;
  plan_type?: string[];
  usage_count?: number;
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
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

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
    // Buscar todas as listas
    const { data: lists, error: listsError } = await supabase
      .from('m3u_lists')
      .select('*')
      .order('created_at', { ascending: false });

    if (listsError) {
      console.error('Erro ao listar M3U:', listsError);
      return [];
    }

    // Buscar todos os vínculos ativos
    const { data: assignments, error: assignmentsError } = await supabase
      .from('client_m3u_lists')
      .select('m3u_list_id')
      .eq('is_active', true);

    if (assignmentsError) {
      console.error('Erro ao buscar vínculos:', assignmentsError);
      return [];
    }

    // Contar vínculos por lista
    const usageMap = new Map<string, number>();
    assignments?.forEach(assignment => {
      const current = usageMap.get(assignment.m3u_list_id) || 0;
      usageMap.set(assignment.m3u_list_id, current + 1);
    });

    // Mapear listas com contagem correta
    return (lists || []).map(list => ({
      ...list,
      usage_count: usageMap.get(list.id) || 0
    }));
  },

  /**
   * Busca listas ativas
   */
  async getActiveLists(): Promise<M3UList[]> {
    // Buscar listas ativas
    const { data: lists, error: listsError } = await supabase
      .from('m3u_lists')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (listsError) {
      console.error('Erro ao buscar listas ativas:', listsError);
      return [];
    }

    // Buscar todos os vínculos ativos
    const { data: assignments, error: assignmentsError } = await supabase
      .from('client_m3u_lists')
      .select('m3u_list_id')
      .eq('is_active', true);

    if (assignmentsError) {
      console.error('Erro ao buscar vínculos:', assignmentsError);
      return [];
    }

    // Contar vínculos por lista
    const usageMap = new Map<string, number>();
    assignments?.forEach(assignment => {
      const current = usageMap.get(assignment.m3u_list_id) || 0;
      usageMap.set(assignment.m3u_list_id, current + 1);
    });

    // Mapear listas com contagem correta
    return (lists || []).map(list => ({
      ...list,
      usage_count: usageMap.get(list.id) || 0
    }));
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
      .select(`
        *,
        client_m3u_lists(count)
      `)
      .eq('id', listId)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar lista M3U:', error);
      return null;
    }

    if (!data) return null;

    return {
      ...data,
      usage_count: data.client_m3u_lists?.[0]?.count || 0
    } as M3UList;
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
