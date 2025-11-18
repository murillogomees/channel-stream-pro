import { supabase } from '@/integrations/supabase/client';

export interface ServiceHealth {
  name: string;
  status: 'operational' | 'degraded' | 'down' | 'unknown';
  latency: number | null;
  lastCheck: number;
  error?: string;
  uptime?: number;
}

export interface SystemHealthStatus {
  overall: 'healthy' | 'degraded' | 'critical' | 'offline';
  services: {
    websocket: ServiceHealth;
    supabase: ServiceHealth;
    whatsapp: ServiceHealth;
    smartone: ServiceHealth;
  };
  lastUpdate: number;
}

class SystemHealthService {
  private healthStatus: SystemHealthStatus;
  private checkInterval: number | null = null;
  private listeners: Map<string, (status: SystemHealthStatus) => void> = new Map();

  constructor() {
    this.healthStatus = this.getInitialStatus();
  }

  private getInitialStatus(): SystemHealthStatus {
    return {
      overall: 'offline',
      services: {
        websocket: {
          name: 'WebSocket Realtime',
          status: 'unknown',
          latency: null,
          lastCheck: 0,
        },
        supabase: {
          name: 'Supabase Database',
          status: 'unknown',
          latency: null,
          lastCheck: 0,
        },
        whatsapp: {
          name: 'WhatsApp API',
          status: 'unknown',
          latency: null,
          lastCheck: 0,
        },
        smartone: {
          name: 'SmartOne IPTV',
          status: 'unknown',
          latency: null,
          lastCheck: 0,
        },
      },
      lastUpdate: Date.now(),
    };
  }

  async startMonitoring(intervalMs: number = 60000) {
    console.log('[SystemHealth] Iniciando monitoramento');
    
    // Initial check
    await this.checkAllServices();
    
    // Set up interval
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    
    this.checkInterval = window.setInterval(() => {
      this.checkAllServices();
    }, intervalMs);
  }

  stopMonitoring() {
    console.log('[SystemHealth] Parando monitoramento');
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  async checkAllServices(): Promise<SystemHealthStatus> {
    console.log('[SystemHealth] Verificando saúde de todos os serviços');
    
    await Promise.all([
      this.checkSupabase(),
      this.checkWhatsApp(),
      this.checkSmartOne(),
    ]);
    
    this.updateOverallStatus();
    this.healthStatus.lastUpdate = Date.now();
    this.notifyListeners();
    
    return this.healthStatus;
  }

  private async checkSupabase(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Test database connectivity with a real query
      const { data, error } = await supabase
        .from('clientes')
        .select('id')
        .limit(1);
      
      const latency = Date.now() - startTime;
      
      if (error) {
        this.healthStatus.services.supabase = {
          name: 'Supabase Database',
          status: 'down',
          latency,
          lastCheck: Date.now(),
          error: error.message,
        };
      } else {
        this.healthStatus.services.supabase = {
          name: 'Supabase Database',
          status: latency > 2000 ? 'degraded' : 'operational',
          latency,
          lastCheck: Date.now(),
        };
      }
    } catch (error) {
      this.healthStatus.services.supabase = {
        name: 'Supabase Database',
        status: 'down',
        latency: null,
        lastCheck: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async checkWhatsApp(): Promise<void> {
    // Check if WhatsApp credentials are configured
    const appkey = localStorage.getItem('whatsapp_config');
    
    if (!appkey) {
      this.healthStatus.services.whatsapp = {
        name: 'WhatsApp API',
        status: 'unknown',
        latency: null,
        lastCheck: Date.now(),
        error: 'Não configurado',
      };
      return;
    }

    try {
      const config = JSON.parse(appkey);
      
      if (!config.appkey || !config.authkey) {
        this.healthStatus.services.whatsapp = {
          name: 'WhatsApp API',
          status: 'unknown',
          latency: null,
          lastCheck: Date.now(),
          error: 'Credenciais incompletas',
        };
        return;
      }

      // We can't directly check the API without making a real request
      // So we just check if it's configured
      this.healthStatus.services.whatsapp = {
        name: 'WhatsApp API',
        status: config.enabled ? 'operational' : 'unknown',
        latency: null,
        lastCheck: Date.now(),
      };
    } catch (error) {
      this.healthStatus.services.whatsapp = {
        name: 'WhatsApp API',
        status: 'unknown',
        latency: null,
        lastCheck: Date.now(),
        error: 'Erro ao verificar configuração',
      };
    }
  }

  private async checkSmartOne(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Test SmartOne API connectivity
      const baseUrl = import.meta.env.VITE_SMARTONE_API_BASE_URL || 'https://api.smartone.tv';
      const apiKey = import.meta.env.VITE_SMARTONE_KEY_API;
      
      if (!apiKey) {
        this.healthStatus.services.smartone = {
          name: 'SmartOne IPTV',
          status: 'unknown',
          latency: null,
          lastCheck: Date.now(),
          error: 'API Key não configurada',
        };
        return;
      }

      const response = await fetch(`${baseUrl}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      const latency = Date.now() - startTime;

      if (!response.ok) {
        this.healthStatus.services.smartone = {
          name: 'SmartOne IPTV',
          status: 'down',
          latency,
          lastCheck: Date.now(),
          error: `HTTP ${response.status}`,
        };
      } else {
        this.healthStatus.services.smartone = {
          name: 'SmartOne IPTV',
          status: latency > 3000 ? 'degraded' : 'operational',
          latency,
          lastCheck: Date.now(),
        };
      }
    } catch (error) {
      this.healthStatus.services.smartone = {
        name: 'SmartOne IPTV',
        status: 'down',
        latency: null,
        lastCheck: Date.now(),
        error: error instanceof Error ? error.message : 'Erro de conexão',
      };
    }
  }

  updateWebSocketHealth(health: ServiceHealth) {
    this.healthStatus.services.websocket = health;
    this.updateOverallStatus();
    this.notifyListeners();
  }

  private updateOverallStatus() {
    const services = Object.values(this.healthStatus.services);
    
    const downCount = services.filter(s => s.status === 'down').length;
    const degradedCount = services.filter(s => s.status === 'degraded').length;
    const operationalCount = services.filter(s => s.status === 'operational').length;
    
    if (downCount >= 2) {
      this.healthStatus.overall = 'critical';
    } else if (downCount === 1 || degradedCount >= 2) {
      this.healthStatus.overall = 'degraded';
    } else if (operationalCount === services.length) {
      this.healthStatus.overall = 'healthy';
    } else {
      this.healthStatus.overall = 'degraded';
    }
  }

  subscribe(id: string, callback: (status: SystemHealthStatus) => void) {
    this.listeners.set(id, callback);
  }

  unsubscribe(id: string) {
    this.listeners.delete(id);
  }

  private notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.healthStatus);
      } catch (error) {
        console.error('[SystemHealth] Erro ao notificar listener:', error);
      }
    });
  }

  getStatus(): SystemHealthStatus {
    return { ...this.healthStatus };
  }

  getServiceUptime(serviceName: keyof SystemHealthStatus['services']): number {
    const service = this.healthStatus.services[serviceName];
    if (!service.lastCheck) return 0;
    return Date.now() - service.lastCheck;
  }
}

// Singleton
let systemHealthInstance: SystemHealthService | null = null;

export function getSystemHealthService(): SystemHealthService {
  if (!systemHealthInstance) {
    systemHealthInstance = new SystemHealthService();
  }
  return systemHealthInstance;
}
