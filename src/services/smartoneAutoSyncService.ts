import { supabase } from "@/integrations/supabase/client";
import type { SituacaoCliente, PlanoCliente } from "@/types/cliente";

interface SyncClientData {
  user_id: string;
  cliente_id: string;
  nome: string;
  telefone: string;
  email: string;
  mac_smart_one?: string;
  usuario_m3u?: string;
  senha_m3u?: string;
  situacao?: SituacaoCliente;
  plano?: PlanoCliente;
}

interface SyncResponse {
  success: boolean;
  smartone_status?: 'criado' | 'erro';
  smartone_data?: any;
  credentials?: {
    username: string;
    password: string;
  };
  error?: string;
  message?: string;
}

export const smartoneAutoSyncService = {
  /**
   * Sincroniza um cliente com o SmartOne IPTV
   */
  async syncClient(data: SyncClientData): Promise<SyncResponse> {
    try {
      console.log('Calling sync-new-client edge function...', data);

      const { data: result, error } = await supabase.functions.invoke('sync-new-client', {
        body: data,
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      console.log('Sync result:', result);
      return result as SyncResponse;
    } catch (error: any) {
      console.error('Error in syncClient:', error);
      return {
        success: false,
        error: error.message || 'Erro ao sincronizar com SmartOne',
      };
    }
  },

  /**
   * Sincroniza um cliente após cadastro, se tiver MAC address
   */
  async syncAfterRegistration(
    userId: string,
    clienteId: string,
    profileData: { nome: string; telefone: string; email: string },
    clienteData?: { 
      mac_smart_one?: string; 
      usuario_m3u?: string; 
      senha_m3u?: string;
      situacao?: SituacaoCliente;
      plano?: PlanoCliente;
    }
  ): Promise<SyncResponse> {
    // Se não tiver MAC, não faz sincronização
    if (!clienteData?.mac_smart_one) {
      return {
        success: false,
        message: 'MAC address não fornecido',
      };
    }

    return this.syncClient({
      user_id: userId,
      cliente_id: clienteId,
      nome: profileData.nome,
      telefone: profileData.telefone,
      email: profileData.email,
      mac_smart_one: clienteData.mac_smart_one,
      usuario_m3u: clienteData.usuario_m3u,
      senha_m3u: clienteData.senha_m3u,
      situacao: clienteData.situacao,
      plano: clienteData.plano,
    });
  },
};
