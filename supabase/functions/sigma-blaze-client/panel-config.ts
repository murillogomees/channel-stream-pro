/**
 * ============================================
 * PANEL CONFIG - Busca credenciais do painel ativo
 * ============================================
 * 
 * Este módulo busca as credenciais do painel Sigma ativo
 * no banco de dados, permitindo alternar entre painéis
 * sem precisar alterar variáveis de ambiente.
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export interface SigmaPanelConfig {
  id: string;
  name: string;
  base_url: string;
  username: string;
  password: string;
  proxy_url: string | null;
  cf_clearance: string | null;
  current_token: string | null;
  token_expires_at: string | null;
  tenant_id: string | null;
}

// Cache do painel ativo (por tenant)
const panelCache: Map<string, { config: SigmaPanelConfig; fetchedAt: number }> = new Map();
const CACHE_TTL_MS = 60 * 1000; // 1 minuto

function getSupabase(): SupabaseClient | null {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Master tenant ID constant
const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Busca o painel Sigma ativo para um tenant específico.
 * 
 * REGRAS DE ISOLAMENTO:
 * - Se tenantId for uma revenda, APENAS retorna painel dessa revenda (se existir)
 * - Se tenantId for master ou null, pode usar painel master ou env vars
 * - Revenda NUNCA acessa painel do Master (mesmo como fallback)
 */
export async function getActivePanelConfig(tenantId?: string | null): Promise<SigmaPanelConfig | null> {
  const isMasterOrGlobal = !tenantId || tenantId === MASTER_TENANT_ID;
  const cacheKey = tenantId || "__global__";
  const now = Date.now();

  // Verificar cache
  const cached = panelCache.get(cacheKey);
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    console.log(`[panel-config] Using cached panel config for tenant ${cacheKey}`);
    return cached.config;
  }

  const supabase = getSupabase();
  if (!supabase) {
    console.warn("[panel-config] Supabase client not available");
    // SEGURANÇA: Apenas master pode usar fallback env vars
    return isMasterOrGlobal ? getFallbackConfig() : null;
  }

  try {
    let panelData = null;
    
    // Tentar buscar painel específico do tenant
    if (tenantId && tenantId !== MASTER_TENANT_ID) {
      const { data } = await supabase
        .from("sigma_panels")
        .select("id, name, base_url, username, password_encrypted, proxy_url, cf_clearance, current_token, token_expires_at, tenant_id")
        .eq("is_active", true)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      
      panelData = data;
      
      if (panelData) {
        console.log(`[panel-config] Found active panel for tenant ${tenantId}`);
      } else {
        // SEGURANÇA CRÍTICA: Revenda SEM painel próprio NÃO pode usar painel do Master
        console.warn(`[panel-config] BLOCKED: Tenant ${tenantId} has no panel configured. Cannot fallback to master.`);
        return null;
      }
    }
    
    // Se não encontrou painel específico E é master/global, buscar painel master/global
    if (!panelData && isMasterOrGlobal) {
      const { data, error } = await supabase
        .from("sigma_panels")
        .select("id, name, base_url, username, password_encrypted, proxy_url, cf_clearance, current_token, token_expires_at, tenant_id")
        .eq("is_active", true)
        .or(`tenant_id.eq.${MASTER_TENANT_ID},tenant_id.is.null`)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("[panel-config] Error fetching master panel:", error.message);
      } else {
        panelData = data;
        if (panelData) {
          console.log(`[panel-config] Using master/global panel for tenant ${cacheKey}`);
        }
      }
    }

    if (!panelData) {
      console.log(`[panel-config] No active panel found, trying fallback`);
      // SEGURANÇA: Apenas master pode usar fallback env vars
      return isMasterOrGlobal ? getFallbackConfig() : null;
    }

    const config: SigmaPanelConfig = {
      id: panelData.id,
      name: panelData.name,
      base_url: panelData.base_url,
      username: panelData.username,
      password: panelData.password_encrypted,
      proxy_url: panelData.proxy_url,
      cf_clearance: panelData.cf_clearance,
      current_token: panelData.current_token,
      token_expires_at: panelData.token_expires_at,
      tenant_id: panelData.tenant_id,
    };

    // Atualizar cache
    panelCache.set(cacheKey, { config, fetchedAt: now });

    console.log(`[panel-config] Loaded active panel "${config.name}" for tenant ${cacheKey}`);
    return config;
  } catch (e) {
    console.error("[panel-config] Exception fetching panel config:", e);
    return getFallbackConfig();
  }
}

/**
 * Fallback para variáveis de ambiente (compatibilidade retroativa)
 */
function getFallbackConfig(): SigmaPanelConfig | null {
  const apiUrl = Deno.env.get("SIGMA_BLAZE_API_URL");
  const username = Deno.env.get("SIGMA_BLAZE_USERNAME");
  const password = Deno.env.get("SIGMA_BLAZE_PASSWORD");

  if (!apiUrl || !username || !password) {
    return null;
  }

  return {
    id: "__env__",
    name: "Environment Variables",
    base_url: apiUrl,
    username,
    password,
    proxy_url: Deno.env.get("RESIDENTIAL_PROXY_URL") || null,
    cf_clearance: Deno.env.get("BLAZE_CF_CLEARANCE") || null,
    current_token: Deno.env.get("SIGMA_AUTH_TOKEN") || null,
    token_expires_at: null,
    tenant_id: null,
  };
}

/**
 * Atualiza o token do painel no banco de dados
 */
export async function updatePanelToken(
  panelId: string,
  token: string,
  expiresAt: Date
): Promise<void> {
  if (panelId === "__env__") {
    // Não atualiza env vars
    return;
  }

  const supabase = getSupabase();
  if (!supabase) return;

  try {
    await supabase
      .from("sigma_panels")
      .update({
        current_token: token,
        token_expires_at: expiresAt.toISOString(),
        token_last_refreshed_at: new Date().toISOString(),
        last_login_at: new Date().toISOString(),
        last_login_error: null,
      })
      .eq("id", panelId);

    console.log(`[panel-config] Token updated for panel ${panelId}`);

    // Invalidar cache
    panelCache.clear();
  } catch (e) {
    console.error("[panel-config] Failed to update panel token:", e);
  }
}

/**
 * Registra erro de login no painel
 */
export async function updatePanelLoginError(
  panelId: string,
  errorMessage: string
): Promise<void> {
  if (panelId === "__env__") return;

  const supabase = getSupabase();
  if (!supabase) return;

  try {
    await supabase
      .from("sigma_panels")
      .update({
        last_login_error: errorMessage,
        last_error_at: new Date().toISOString(),
      })
      .eq("id", panelId);
  } catch (e) {
    console.error("[panel-config] Failed to update panel error:", e);
  }
}

/**
 * Incrementa contador de requisições do painel
 */
export async function incrementPanelRequests(panelId: string): Promise<void> {
  if (panelId === "__env__") return;

  const supabase = getSupabase();
  if (!supabase) return;

  try {
    // Usar RPC para incrementar atomicamente
    await supabase.rpc("increment_sigma_panel_requests", { panel_id: panelId });
  } catch (e) {
    // Silently fail - não é crítico
  }
}

/**
 * Limpa o cache do painel (útil após alternar painéis)
 */
export function clearPanelCache(tenantId?: string | null): void {
  if (tenantId) {
    panelCache.delete(tenantId);
    panelCache.delete("__global__");
  } else {
    panelCache.clear();
  }
  console.log("[panel-config] Cache cleared");
}
