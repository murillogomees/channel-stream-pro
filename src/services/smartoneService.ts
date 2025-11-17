import { supabase } from '@/integrations/supabase/client';
import { Cliente } from '@/types/cliente';
import { z } from 'zod';

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

export interface SmartOneTestPlaylist {
  nome: string;
  mac: string;
  usuario: string;
  senha: string;
  descricao?: string;
}

export interface SmartOneTestResult {
  id: string;
  action: 'create' | 'update' | 'delete';
  success: boolean;
  playlistId?: string;
  nome: string;
  mac: string;
  m3uUrl?: string;
  descricao?: string;
  error?: string;
  timestamp: string;
  rawResponse?: any;
}

// Validação de MAC Address - aceita formatos: XX:XX:XX:XX:XX:XX, XX-XX-XX-XX-XX-XX ou XXXXXXXXXXXX
const macAddressSchema = z.string()
  .trim()
  .regex(
    /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$|^[0-9A-Fa-f]{12}$/,
    'MAC Address inválido. Use o formato: 00:1A:2B:3C:4D:5E, 00-1A-2B-3C-4D-5E ou 001A2B3C4D5E'
  );

export const validateMacAddress = (mac: string): { valid: boolean; error?: string } => {
  try {
    macAddressSchema.parse(mac);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, error: error.errors[0].message };
    }
    return { valid: false, error: 'Formato de MAC Address inválido' };
  }
};

// Normaliza MAC Address para o formato padrão XX:XX:XX:XX:XX:XX
export const normalizeMacAddress = (mac: string): string => {
  // Remove espaços
  let normalized = mac.trim().toUpperCase();
  
  // Se não tem separadores, adiciona :
  if (normalized.length === 12 && !normalized.includes(':') && !normalized.includes('-')) {
    normalized = normalized.match(/.{1,2}/g)?.join(':') || normalized;
  }
  
  // Converte - para :
  normalized = normalized.replace(/-/g, ':');
  
  return normalized;
};

// Gera um MAC Address aleatório válido
export const generateRandomMacAddress = (): string => {
  const hexChars = '0123456789ABCDEF';
  const octets: string[] = [];
  
  for (let i = 0; i < 6; i++) {
    const octet = hexChars[Math.floor(Math.random() * 16)] + hexChars[Math.floor(Math.random() * 16)];
    octets.push(octet);
  }
  
  return octets.join(':');
};

// Gerenciamento de histórico de MACs
const MAC_HISTORY_KEY = 'smartone_mac_history';
const MAX_MAC_HISTORY = 10;

export const saveMacToHistory = (mac: string): void => {
  const history = getMacHistory();
  const normalized = normalizeMacAddress(mac);
  
  // Remove duplicatas e adiciona no início
  const updated = [normalized, ...history.filter(m => m !== normalized)].slice(0, MAX_MAC_HISTORY);
  localStorage.setItem(MAC_HISTORY_KEY, JSON.stringify(updated));
};

export const getMacHistory = (): string[] => {
  const stored = localStorage.getItem(MAC_HISTORY_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const clearMacHistory = (): void => {
  localStorage.removeItem(MAC_HISTORY_KEY);
};

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

  async testCreatePlaylist(playlist: SmartOneTestPlaylist): Promise<SmartOneTestResult> {
    // Validar MAC Address
    const macValidation = validateMacAddress(playlist.mac);
    if (!macValidation.valid) {
      return {
        id: crypto.randomUUID(),
        action: 'create',
        success: false,
        nome: playlist.nome,
        mac: playlist.mac,
        error: macValidation.error,
        timestamp: new Date().toISOString(),
      };
    }

    const config = await this.getConfig();
    
    if (!config.enabled || !config.baseUrl || !config.clientApi || !config.keyApi) {
      return {
        id: crypto.randomUUID(),
        action: 'create',
        success: false,
        nome: playlist.nome,
        mac: playlist.mac,
        error: 'Configuração SmartOne incompleta',
        timestamp: new Date().toISOString(),
      };
    }

    // Normalizar MAC Address
    const normalizedMac = normalizeMacAddress(playlist.mac);

    try {
      const { data, error } = await supabase.functions.invoke('smartone-test', {
        body: {
          action: 'create',
          playlist: {
            nome: playlist.nome,
            mac: normalizedMac,
            usuario: playlist.usuario,
            senha: playlist.senha,
            descricao: playlist.descricao || '',
          },
        },
      });

      if (error) {
      return {
        id: crypto.randomUUID(),
        action: 'create',
        success: false,
        nome: playlist.nome,
        mac: normalizedMac,
        error: error.message,
        timestamp: new Date().toISOString(),
        rawResponse: error,
      };
    }

    return {
      id: crypto.randomUUID(),
      action: 'create',
      success: true,
      playlistId: data.playlistId || data.id,
      nome: playlist.nome,
      mac: normalizedMac,
      m3uUrl: data.m3uUrl,
      descricao: playlist.descricao,
      timestamp: new Date().toISOString(),
      rawResponse: data,
    };
  } catch (error: any) {
    return {
      id: crypto.randomUUID(),
      action: 'create',
      success: false,
      nome: playlist.nome,
      mac: normalizedMac,
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}

  async testUpdatePlaylist(playlistId: string, playlist: SmartOneTestPlaylist): Promise<SmartOneTestResult> {
    // Validar MAC Address
    const macValidation = validateMacAddress(playlist.mac);
    if (!macValidation.valid) {
      return {
        id: crypto.randomUUID(),
        action: 'update',
        success: false,
        playlistId,
        nome: playlist.nome,
        mac: playlist.mac,
        error: macValidation.error,
        timestamp: new Date().toISOString(),
      };
    }

    // Normalizar MAC Address
    const normalizedMac = normalizeMacAddress(playlist.mac);

    try {
      const { data, error } = await supabase.functions.invoke('smartone-test', {
        body: {
          action: 'update',
          playlistId,
          playlist: {
            nome: playlist.nome,
            mac: normalizedMac,
            usuario: playlist.usuario,
            senha: playlist.senha,
            descricao: playlist.descricao || '',
          },
        },
      });

      if (error) {
        return {
          id: crypto.randomUUID(),
          action: 'update',
          success: false,
          playlistId,
          nome: playlist.nome,
          mac: normalizedMac,
          error: error.message,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        id: crypto.randomUUID(),
        action: 'update',
        success: true,
        playlistId,
        nome: playlist.nome,
        mac: normalizedMac,
        m3uUrl: data.m3uUrl,
        descricao: playlist.descricao,
        timestamp: new Date().toISOString(),
        rawResponse: data,
      };
    } catch (error: any) {
      return {
        id: crypto.randomUUID(),
        action: 'update',
        success: false,
        playlistId,
        nome: playlist.nome,
        mac: normalizedMac,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async testDeletePlaylist(playlistId: string, nome: string, mac: string): Promise<SmartOneTestResult> {
    try {
      const { data, error } = await supabase.functions.invoke('smartone-test', {
        body: {
          action: 'delete',
          playlistId,
        },
      });

      if (error) {
        return {
          id: crypto.randomUUID(),
          action: 'delete',
          success: false,
          playlistId,
          nome,
          mac,
          error: error.message,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        id: crypto.randomUUID(),
        action: 'delete',
        success: true,
        playlistId,
        nome,
        mac,
        timestamp: new Date().toISOString(),
        rawResponse: data,
      };
    } catch (error: any) {
      return {
        id: crypto.randomUUID(),
        action: 'delete',
        success: false,
        playlistId,
        nome,
        mac,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  getTestHistory(): SmartOneTestResult[] {
    const stored = localStorage.getItem('smartone_test_history');
    return stored ? JSON.parse(stored) : [];
  }

  saveTestResult(result: SmartOneTestResult): void {
    const history = this.getTestHistory();
    history.unshift(result);
    // Manter apenas os últimos 50 testes
    const trimmed = history.slice(0, 50);
    localStorage.setItem('smartone_test_history', JSON.stringify(trimmed));
  }

  clearTestHistory(): void {
    localStorage.removeItem('smartone_test_history');
  }
}

export const smartoneService = new SmartoneService();
