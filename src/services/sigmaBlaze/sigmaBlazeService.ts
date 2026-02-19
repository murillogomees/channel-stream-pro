import { supabase } from '@/integrations/supabase/client';

// Types
export interface SigmaBlazeConfig {
  id: string;
  api_url: string;
  api_key: string;
  sigma_username: string;
  sigma_password: string;
  admin_whatsapp_number: string;
  whatsapp_message_template: string;
  is_active: boolean;
  proxy_host: string;
  proxy_port: number;
  proxy_user: string;
  proxy_pass: string;
}

export interface SigmaFlag {
  id: string;
  flag_name: string;
  enabled: boolean;
  description: string;
}

export interface PackageMapping {
  id: string;
  internal_plan_id: string;
  internal_plan_name: string;
  sigma_package_id: string;
  sigma_package_name: string;
  is_active: boolean;
}

export interface SigmaLog {
  id: string;
  action: string;
  status: string;
  user_id: string | null;
  details: any;
  created_at: string;
}

const SIGMA_FLAGS = [
  'SIGMA_AUTO_CREATE_CLIENT',
  'SIGMA_AUTO_DELETE_CLIENT',
  'SIGMA_AUTO_UPDATE_PACKAGE',
  'SIGMA_WHATSAPP_ACTIVATION',
];

export async function getConfig(): Promise<SigmaBlazeConfig | null> {
  const { data } = await supabase
    .from('sigma_blaze_config')
    .select('*')
    .limit(1)
    .single();
  if (!data) return null;
  return {
    ...data,
    api_key: data.api_key ? '••••••' + data.api_key.slice(-4) : '',
    sigma_password: data.sigma_password ? '••••••' : '',
    proxy_pass: data.proxy_pass ? '••••••' : '',
  } as SigmaBlazeConfig;
}

export async function saveConfig(config: Partial<SigmaBlazeConfig> & { raw_api_key?: string; raw_password?: string; raw_proxy_pass?: string }): Promise<{ success: boolean; error?: string }> {
  const updateData: any = {};
  if (config.api_url !== undefined) updateData.api_url = config.api_url;
  if (config.raw_api_key) updateData.api_key = config.raw_api_key;
  if (config.sigma_username !== undefined) updateData.sigma_username = config.sigma_username;
  if (config.raw_password) updateData.sigma_password = config.raw_password;
  if (config.admin_whatsapp_number !== undefined) updateData.admin_whatsapp_number = config.admin_whatsapp_number;
  if (config.whatsapp_message_template !== undefined) updateData.whatsapp_message_template = config.whatsapp_message_template;
  if (config.is_active !== undefined) updateData.is_active = config.is_active;
  if (config.proxy_host !== undefined) updateData.proxy_host = config.proxy_host;
  if (config.proxy_port !== undefined) updateData.proxy_port = config.proxy_port;
  if (config.proxy_user !== undefined) updateData.proxy_user = config.proxy_user;
  if (config.raw_proxy_pass) updateData.proxy_pass = config.raw_proxy_pass;

  // Don't send masked values as real data
  if (updateData.api_key && updateData.api_key.startsWith('••••')) delete updateData.api_key;
  if (updateData.sigma_password && updateData.sigma_password.startsWith('••••')) delete updateData.sigma_password;
  if (updateData.proxy_pass && updateData.proxy_pass.startsWith('••••')) delete updateData.proxy_pass;

  console.log('[SigmaBlaze] Saving config:', { id: config.id, fields: Object.keys(updateData) });

  if (config.id) {
    const { error, count } = await supabase
      .from('sigma_blaze_config')
      .update(updateData)
      .eq('id', config.id);
    if (error) {
      console.error('[SigmaBlaze] Save error:', error);
      return { success: false, error: error.message };
    }
    console.log('[SigmaBlaze] Save success, rows affected:', count);
    return { success: true };
  }
  const { error } = await supabase
    .from('sigma_blaze_config')
    .insert(updateData);
  if (error) {
    console.error('[SigmaBlaze] Insert error:', error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function getFlags(): Promise<SigmaFlag[]> {
  const { data } = await supabase
    .from('feature_flag_config')
    .select('id, flag_name, enabled, description')
    .in('flag_name', SIGMA_FLAGS);
  return (data || []) as SigmaFlag[];
}

export async function toggleFlag(flagName: string, enabled: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('feature_flag_config')
    .update({ enabled })
    .eq('flag_name', flagName);
  return !error;
}

export async function getPackageMappings(): Promise<PackageMapping[]> {
  const { data } = await supabase
    .from('subscription_package_mapping')
    .select('*')
    .order('internal_plan_name');
  return (data || []) as PackageMapping[];
}

export async function saveMapping(mapping: Partial<PackageMapping>): Promise<boolean> {
  if (mapping.id) {
    const { error } = await supabase
      .from('subscription_package_mapping')
      .update({
        sigma_package_id: mapping.sigma_package_id,
        sigma_package_name: mapping.sigma_package_name,
        is_active: mapping.is_active,
      })
      .eq('id', mapping.id);
    return !error;
  }
  const { error } = await supabase
    .from('subscription_package_mapping')
    .insert({
      internal_plan_id: mapping.internal_plan_id,
      internal_plan_name: mapping.internal_plan_name,
      sigma_package_id: mapping.sigma_package_id || '',
      sigma_package_name: mapping.sigma_package_name || '',
      is_active: mapping.is_active ?? true,
    });
  return !error;
}

export async function getLogs(filters?: { action?: string; status?: string }): Promise<SigmaLog[]> {
  let query = supabase
    .from('sigma_blaze_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (filters?.action) query = query.eq('action', filters.action);
  if (filters?.status) query = query.eq('status', filters.status);

  const { data } = await query;
  return (data || []) as SigmaLog[];
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}: tempo limite de ${ms / 1000}s excedido`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

export async function triggerAction(
  action: string,
  params: Record<string, any>
): Promise<{ success: boolean; message?: string }> {
  try {
    const { data, error } = await withTimeout(
      supabase.functions.invoke('sigma-blaze-client', {
        body: { action, ...params },
      }),
      15000,
      'Sigma Blaze'
    );
    if (error) return { success: false, message: error.message };
    return data;
  } catch (err: any) {
    return { success: false, message: err.message || 'Timeout na requisição' };
  }
}

export async function saveConfigWithTimeout(config: Parameters<typeof saveConfig>[0]): Promise<{ success: boolean; error?: string }> {
  try {
    return await withTimeout(saveConfig(config), 10000, 'Salvar config');
  } catch (err: any) {
    return { success: false, error: err.message || 'Timeout ao salvar' };
  }
}
