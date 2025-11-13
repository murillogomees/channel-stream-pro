import { supabase } from '@/integrations/supabase/client';
import { Cliente } from '@/types/cliente';

export interface SmartOneConfig {
  enabled: boolean;
  baseUrl: string;
  clientApi: string;
  keyApi: string;
}

export interface SmartOneSyncResult {
  success: boolean;
  status: 'criado' | 'erro';
  playlistId?: string;
  rawResponse: any;
  error?: string;
}

class SmartoneService {
  private config: SmartOneConfig | null = null;

  async getConfig(): Promise<SmartOneConfig> {
    if (this.config) return this.config;

    // Buscar configurações do localStorage
    const stored = localStorage.getItem('smartone_config');
    if (stored) {
      this.config = JSON.parse(stored);
      return this.config;
    }

    // Configuração padrão
    this.config = {
      enabled: true,
      baseUrl: '',
      clientApi: '',
      keyApi: '',
    };

    return this.config;
  }

  async updateConfig(config: Partial<SmartOneConfig>): Promise<void> {
    const current = await this.getConfig();
    this.config = { ...current, ...config };
    localStorage.setItem('smartone_config', JSON.stringify(this.config));
  }

  async syncPlaylistForClient(
    cliente: Cliente,
    updateClienteFn: (id: string, data: Partial<Cliente>) => void
  ): Promise<SmartOneSyncResult> {
    const config = await this.getConfig();

    // Validações
    if (!config.enabled) {
      return {
        success: false,
        status: 'erro',
        rawResponse: null,
        error: 'Integração SmartOne desabilitada',
      };
    }

    if (!cliente.macSmartOne) {
      return {
        success: false,
        status: 'erro',
        rawResponse: null,
        error: 'Cliente não possui MAC cadastrado',
      };
    }

    if (!cliente.usuario || !cliente.senha) {
      return {
        success: false,
        status: 'erro',
        rawResponse: null,
        error: 'Cliente não possui credenciais M3U cadastradas',
      };
    }

    // Atualizar status para pendente
    updateClienteFn(cliente.id, {
      smartone_status: 'pendente',
      smartone_last_sync_at: new Date().toISOString(),
    });

    try {
      // Chamar edge function que fará a integração
      const { data, error } = await supabase.functions.invoke('smartone-sync', {
        body: {
          mac: cliente.macSmartOne,
          usuario: cliente.usuario,
          senha: cliente.senha,
          clienteNome: cliente.nome,
        },
      });

      if (error) {
        console.error('Erro ao sincronizar com SmartOne:', error);
        
        updateClienteFn(cliente.id, {
          smartone_status: 'erro',
          smartone_raw_response: JSON.stringify({ error: error.message }),
          smartone_last_sync_at: new Date().toISOString(),
        });

        return {
          success: false,
          status: 'erro',
          rawResponse: error,
          error: error.message,
        };
      }

      // Sucesso
      updateClienteFn(cliente.id, {
        smartone_status: 'criado',
        smartone_playlist_id: data.playlistId || data.id || 'N/A',
        smartone_raw_response: JSON.stringify(data),
        smartone_last_sync_at: new Date().toISOString(),
      });

      return {
        success: true,
        status: 'criado',
        playlistId: data.playlistId || data.id,
        rawResponse: data,
      };
    } catch (error: any) {
      console.error('Erro ao sincronizar com SmartOne:', error);

      updateClienteFn(cliente.id, {
        smartone_status: 'erro',
        smartone_raw_response: JSON.stringify({ error: error.message }),
        smartone_last_sync_at: new Date().toISOString(),
      });

      return {
        success: false,
        status: 'erro',
        rawResponse: error,
        error: error.message,
      };
    }
  }
}

export const smartoneService = new SmartoneService();
