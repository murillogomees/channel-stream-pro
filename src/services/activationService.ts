import { Preferences } from '@capacitor/preferences';
import { Device } from '@capacitor/device';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'app_device_session';

export interface DeviceSession {
  deviceId: string;
  userId: string;
  expiresAt: string;
  m3uUrl: string;
  activatedAt: string;
}

export interface ActivationResult {
  success: boolean;
  session?: DeviceSession;
  error?: string;
}

export interface SubscriptionStatus {
  active: boolean;
  userId?: string;
  expiresAt?: string;
  daysRemaining?: number;
  m3uUrl?: string;
  status?: string;
}

/**
 * Gera ou recupera um device_id único para o dispositivo
 */
export async function getDeviceId(): Promise<string> {
  try {
    // Tentar recuperar device_id salvo
    const { value } = await Preferences.get({ key: 'device_unique_id' });
    
    if (value) {
      return value;
    }

    // Gerar novo device_id baseado no UUID do dispositivo
    const info = await Device.getId();
    const deviceId = info.identifier || `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Salvar para uso futuro
    await Preferences.set({ key: 'device_unique_id', value: deviceId });
    
    return deviceId;
  } catch (error) {
    console.error('Error getting device ID:', error);
    // Fallback para web
    const webDeviceId = `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await Preferences.set({ key: 'device_unique_id', value: webDeviceId });
    return webDeviceId;
  }
}

/**
 * Valida uma chave de ativação
 */
export async function validateActivationKey(key: string): Promise<ActivationResult> {
  try {
    const { data, error } = await supabase.rpc('validate_activation_key', {
      p_key: key.toUpperCase()
    });

    if (error) {
      console.error('Validation error:', error);
      return { success: false, error: 'Erro ao validar chave de ativação' };
    }

    if (!data || data.length === 0) {
      return { success: false, error: 'Chave de ativação inválida' };
    }

    const result = data[0];
    
    if (!result.valid) {
      return { success: false, error: 'Chave inválida ou expirada' };
    }

    return { success: true };
  } catch (error) {
    console.error('Validation exception:', error);
    return { success: false, error: 'Erro ao conectar com o servidor' };
  }
}

/**
 * Ativa o dispositivo com uma chave de ativação
 */
export async function activateDevice(activationKey: string): Promise<ActivationResult> {
  try {
    const deviceId = await getDeviceId();

    const { data, error } = await supabase.rpc('activate_device', {
      p_activation_key: activationKey.toUpperCase(),
      p_device_id: deviceId
    });

    if (error) {
      console.error('Activation error:', error);
      return { success: false, error: 'Erro ao ativar dispositivo' };
    }

    if (!data || data.length === 0) {
      return { success: false, error: 'Falha na ativação' };
    }

    const result = data[0];
    
    if (!result.success) {
      return { success: false, error: result.error_message };
    }

    // Criar sessão
    const session: DeviceSession = {
      deviceId,
      userId: deviceId, // Usar device_id como userId
      expiresAt: result.expires_at,
      m3uUrl: '', // M3U URL será obtido do plano
      activatedAt: new Date().toISOString()
    };

    // Salvar sessão
    await saveSession(session);

    return { success: true, session };
  } catch (error) {
    console.error('Activation exception:', error);
    return { success: false, error: 'Erro ao conectar com o servidor' };
  }
}

/**
 * Verifica o status da assinatura do dispositivo
 */
export async function checkSubscription(): Promise<SubscriptionStatus> {
  try {
    const deviceId = await getDeviceId();

    const { data, error } = await supabase.rpc('check_device_subscription', {
      p_device_id: deviceId
    });

    if (error) {
      console.error('Subscription check error:', error);
      return { active: false };
    }

    if (!data || data.length === 0) {
      return { active: false, status: 'not_found' };
    }

    const result = data[0];

    return {
      active: result.active,
      userId: deviceId,
      expiresAt: result.expires_at,
      daysRemaining: result.days_remaining,
      m3uUrl: result.m3u_url || '',
      status: result.status
    };
  } catch (error) {
    console.error('Subscription check exception:', error);
    return { active: false };
  }
}

/**
 * Salva a sessão do dispositivo
 */
export async function saveSession(session: DeviceSession): Promise<void> {
  try {
    await Preferences.set({
      key: STORAGE_KEY,
      value: JSON.stringify(session)
    });
  } catch (error) {
    console.error('Error saving session:', error);
  }
}

/**
 * Recupera a sessão salva
 */
export async function getSession(): Promise<DeviceSession | null> {
  try {
    const { value } = await Preferences.get({ key: STORAGE_KEY });
    
    if (!value) {
      return null;
    }

    return JSON.parse(value);
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
}

/**
 * Limpa a sessão
 */
export async function clearSession(): Promise<void> {
  try {
    await Preferences.remove({ key: STORAGE_KEY });
  } catch (error) {
    console.error('Error clearing session:', error);
  }
}

/**
 * Obtém informações do dispositivo
 */
async function getDeviceInfo(): Promise<any> {
  try {
    const [deviceInfo, batteryInfo] = await Promise.all([
      Device.getInfo(),
      Device.getBatteryInfo().catch(() => null)
    ]);

    return {
      model: deviceInfo.model,
      platform: deviceInfo.platform,
      operatingSystem: deviceInfo.operatingSystem,
      osVersion: deviceInfo.osVersion,
      manufacturer: deviceInfo.manufacturer,
      isVirtual: deviceInfo.isVirtual,
      batteryLevel: batteryInfo?.batteryLevel,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting device info:', error);
    return {
      platform: 'web',
      timestamp: new Date().toISOString()
    };
  }
}
