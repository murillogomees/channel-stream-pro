import { supabase } from "@/integrations/supabase/client";
import type { PlanoCliente, SituacaoCliente } from "@/types/cliente";

export type M3UPlanType = 'teste' | 'basico' | 'premium';

export interface M3UListWithPlan {
  id: string;
  name: string;
  file_url: string;
  status: string;
  plan_type: M3UPlanType[];
  priority: number;
  is_default: boolean;
  created_at: string;
}

/**
 * Serviço para gerenciar listas M3U baseadas em planos de clientes
 */
export const m3uPlanService = {
  /**
   * Determina o tipo de plano M3U apropriado para um cliente
   */
  getPlanTypeForClient(
    situacao: SituacaoCliente,
    plano?: PlanoCliente
  ): M3UPlanType {
    // Clientes em teste ou leads recebem lista de teste
    if (situacao === 'Testando' || situacao === 'Lead') {
      return 'teste';
    }

    // Clientes com planos longos recebem lista premium
    if (plano === 'Semestral' || plano === 'Anual') {
      return 'premium';
    }

    // Demais clientes recebem lista básica
    return 'basico';
  },

  /**
   * Obtém a lista M3U apropriada para um cliente usando a função SQL
   */
  async getM3UForClient(
    situacao: SituacaoCliente,
    plano?: PlanoCliente
  ): Promise<string | null> {
    try {
      const { data, error } = await supabase.rpc('get_m3u_for_client_plan', {
        cliente_plano: plano || 'Mensal',
        cliente_situacao: situacao,
      });

      if (error) {
        console.error('Erro ao buscar lista M3U para cliente:', error);
        return null;
      }

      // Buscar URL da lista
      if (data) {
        const { data: listData, error: listError } = await supabase
          .from('m3u_lists')
          .select('file_url')
          .eq('id', data)
          .single();

        if (listError || !listData) {
          console.error('Erro ao buscar URL da lista M3U:', listError);
          return null;
        }

        return listData.file_url;
      }

      return null;
    } catch (error) {
      console.error('Erro ao obter lista M3U para cliente:', error);
      return null;
    }
  },

  /**
   * Lista todas as listas M3U com suas categorias de plano
   */
  async getAllLists(): Promise<M3UListWithPlan[]> {
    const { data, error } = await supabase
      .from('m3u_lists')
      .select('*')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao listar M3U:', error);
      return [];
    }

    return (data || []) as M3UListWithPlan[];
  },

  /**
   * Busca listas por tipo de plano
   */
  async getListsByPlanType(planType: M3UPlanType): Promise<M3UListWithPlan[]> {
    const { data, error } = await supabase
      .from('m3u_lists')
      .select('*')
      .contains('plan_type', [planType])
      .eq('status', 'active')
      .order('priority', { ascending: false });

    if (error) {
      console.error('Erro ao buscar listas por plano:', error);
      return [];
    }

    return (data || []) as M3UListWithPlan[];
  },

  /**
   * Atualiza os tipos de plano de uma lista M3U
   */
  async updateListPlanType(
    listId: string,
    planTypes: M3UPlanType[],
    priority?: number
  ): Promise<boolean> {
    const updateData: any = { plan_type: planTypes };
    if (priority !== undefined) {
      updateData.priority = priority;
    }

    const { error } = await supabase
      .from('m3u_lists')
      .update(updateData)
      .eq('id', listId);

    if (error) {
      console.error('Erro ao atualizar tipos de plano da lista:', error);
      return false;
    }

    return true;
  },

  /**
   * Verifica se um cliente precisa ser re-sincronizado devido a mudança de plano
   */
  async checkClientNeedsResync(clienteId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('clientes')
      .select('smartone_status')
      .eq('id', clienteId)
      .single();

    if (error || !data) {
      return false;
    }

    return data.smartone_status === 'pendente';
  },

  /**
   * Estatísticas de distribuição de listas por plano
   */
  async getPlanDistributionStats() {
    const { data: lists, error: listsError } = await supabase
      .from('m3u_lists')
      .select('plan_type, status');

    const { data: clients, error: clientsError } = await supabase
      .from('clientes')
      .select('situacao, plano');

    if (listsError || clientsError || !lists || !clients) {
      return null;
    }

    const listsByPlan = {
      teste: lists.filter(l => l.plan_type?.includes('teste') && l.status === 'active').length,
      basico: lists.filter(l => l.plan_type?.includes('basico') && l.status === 'active').length,
      premium: lists.filter(l => l.plan_type?.includes('premium') && l.status === 'active').length,
    };

    const clientsByPlan = {
      teste: clients.filter(c => c.situacao === 'Testando' || c.situacao === 'Lead').length,
      basico: clients.filter(c => 
        (c.situacao === 'Ativo' || c.situacao === 'Devendo') &&
        (c.plano === 'Mensal' || c.plano === 'Trimestral')
      ).length,
      premium: clients.filter(c => 
        (c.situacao === 'Ativo' || c.situacao === 'Devendo') &&
        (c.plano === 'Semestral' || c.plano === 'Anual')
      ).length,
    };

    return {
      listsByPlan,
      clientsByPlan,
      total: {
        lists: lists.filter(l => l.status === 'active').length,
        clients: clients.length,
      },
    };
  },
};
