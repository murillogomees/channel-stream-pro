/**
 * ============================================
 * SIGMA SESSION MANAGER - MULTI-PANEL
 * ============================================
 * 
 * Fluxo:
 * 1. Busca painel ativo do banco (sigma_panels) por tenant
 * 2. Usa credenciais do painel ativo (não mais env vars fixas)
 * 3. Login → obtém token
 * 4. Salva token no painel (sigma_panels.current_token)
 * 5. Renova o token a cada 40-50 minutos
 * 
 * Isso permite alternar painéis Sigma apenas mudando is_active no banco.
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getActivePanelConfig, updatePanelToken, updatePanelLoginError, type SigmaPanelConfig } from "./panel-config.ts";

// ==================== CONFIGURAÇÃO ====================
export const SESSION_CONFIG = {
  // Renovar token 10 minutos antes de expirar (token dura ~1h, renovar aos ~50min)
  PROACTIVE_RENEWAL_MARGIN_MS: 10 * 60 * 1000,
  // Tempo mínimo entre tentativas de login (evita spam)
  MIN_LOGIN_INTERVAL_MS: 30 * 1000,
  // Retry máximo para fail-safe
  MAX_RETRIES: 2,
  // Provider name
  PROVIDER: "sigma_blaze",
} as const;

// Contexto do painel atual (definido por getSigmaSession)
let currentPanelConfig: SigmaPanelConfig | null = null;

// ==================== TIPOS ====================
export interface SigmaSession {
  id: string;
  provider: string;
  accessToken: string;
  refreshToken?: string | null;
  sessionCookie: Record<string, string>;
  expiresAt: Date;
  lastValidatedAt: Date;
  isActive: boolean;
  userId?: string | null;
  username?: string | null;
  credits?: number | null;
  uaFingerprint?: string | null;
  sessionHeaders: Record<string, string>;
}

export interface SigmaSessionResult {
  accessToken: string;
  cookies: Record<string, string>;
  headersProntos: Record<string, string>;
  session: SigmaSession;
}

export interface SessionLogEvent {
  event: string;
  reason?: string;
  previousExpiry?: Date;
  newExpiry?: Date;
  metadata?: Record<string, unknown>;
}

// ==================== CACHE EM MEMÓRIA ====================
let cachedToken: { token: string; expiresAt: number } | null = null;
let isRenewing = false;
let lastLoginAttempt = 0;

// ==================== URL HELPERS ====================
function normalizeBlazeBaseUrl(raw: string): string {
  // Sempre retorna a URL base sem trailing slash
  // Se a URL contém /api (ou até /api/auth/login por engano), preserva até /api
  try {
    const u = new URL(raw);
    let path = u.pathname.replace(/\/+$/, "");

    const apiMatch = path.match(/^(.*\/api)/i);
    if (apiMatch) {
      return `${u.origin}${apiMatch[1]}`;
    }

    return u.origin;
  } catch {
    return raw.replace(/\/+$/, "");
  }
}

function joinBlazeUrl(baseUrl: string, endpoint: string): string {
  const b = baseUrl.replace(/\/+$/, "");
  let e = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  // Se base termina com /api e endpoint começa com /api, remover duplicata
  if (b.toLowerCase().endsWith("/api") && e.toLowerCase().startsWith("/api")) {
    e = e.slice(4);
  }

  return `${b}${e}`;
}

// ==================== USER AGENT FIXO ====================
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

type ParsedAuth = { tokenType: "Bearer" | "Token"; token: string };

function parseAuthHeader(raw: string): ParsedAuth {
  const trimmed = String(raw || "").trim();
  const m = trimmed.match(/^(Bearer|Token)\s+(.+)$/i);
  if (m) {
    const tokenType = m[1].toLowerCase() === "token" ? "Token" : "Bearer";
    return { tokenType, token: m[2].trim() };
  }
  return { tokenType: "Bearer", token: trimmed };
}

// ==================== SUPABASE CLIENT ====================
function getSupabase(): SupabaseClient | null {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// ==================== LOGGING ====================
export async function logSessionEvent(event: SessionLogEvent, sessionId?: string): Promise<void> {
  try {
    const supabase = getSupabase();
    if (!supabase) return;

    await supabase.from("sigma_session_logs").insert({
      session_id: sessionId || null,
      event: event.event,
      reason: event.reason || null,
      previous_expiry: event.previousExpiry?.toISOString() || null,
      new_expiry: event.newExpiry?.toISOString() || null,
      metadata: event.metadata || {},
    });

    console.log(`[session-manager] LOG: ${event.event}`, event.reason || "");
  } catch (e) {
    console.warn("[session-manager] Failed to log event:", e);
  }
}

// ==================== HUMAN BEHAVIOR ====================
export async function humanDelay(): Promise<void> {
  const delay = Math.floor(Math.random() * 200) + 100; // 100-300ms
  await new Promise(r => setTimeout(r, delay));
}

// ==================== SESSION HEADERS ====================
export function buildSessionHeaders(rawToken: string, targetUrl?: string): Record<string, string> {
  const parsed = parseAuthHeader(rawToken);

  let origin = "https://blaze.officeb.site";
  if (targetUrl) {
    try {
      const u = new URL(targetUrl);
      origin = u.origin;
    } catch {}
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    "User-Agent": USER_AGENT,
    "Origin": origin,
    "Referer": `${origin}/`,
    "Authorization": `${parsed.tokenType} ${parsed.token}`,
  };

  // CF Clearance bypass
  const cfClearance = Deno.env.get("BLAZE_CF_CLEARANCE");
  if (cfClearance) {
    headers["Cookie"] = `cf_clearance=${cfClearance}`;
  }

  return headers;
}

// ==================== BUSCAR TOKEN DO BANCO ====================
// Compatível com o schema atual de blaze_auth_cache usado pelo sigma-blaze (index.ts)
async function getTokenFromDb(): Promise<{ token: string; expiresAt: number; maybeExpired: boolean } | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("blaze_auth_cache")
    .select("token, expires_hint, last_refreshed_at")
    .eq("id", "singleton")
    .maybeSingle();

  if (error || !data?.token) {
    console.log("[session-manager] No token in blaze_auth_cache", error?.message || "");
    return null;
  }

  const raw = String(data.token);
  const parsed = parseAuthHeader(raw);
  const token = parsed.token;

  if (!token || token.length < 20 || token.startsWith("__")) {
    return null;
  }

  const hintedExp = data.expires_hint ? new Date(String(data.expires_hint)).getTime() : 0;
  const refreshedAt = data.last_refreshed_at ? new Date(String(data.last_refreshed_at)).getTime() : 0;
  const expiresAt = hintedExp || (refreshedAt ? refreshedAt + 60 * 60 * 1000 : 0) || (Date.now() + 60 * 60 * 1000);

  // Se não temos um hint confiável, tratamos como "pode estar expirado" para renovar em background
  const maybeExpired = expiresAt <= Date.now() + 2 * 60 * 1000;

  return { token, expiresAt, maybeExpired };
}

// ==================== SALVAR TOKEN NO BANCO ====================
// Compatível com o schema atual de blaze_auth_cache (token + expires_hint + last_refreshed_at)
async function saveTokenToDb(tokenRaw: string, expiresAtMs: number, username?: string, credits?: number): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    console.error("[session-manager] saveTokenToDb: Supabase client not available!");
    return;
  }

  const parsed = parseAuthHeader(tokenRaw);
  const token = parsed.token;
  const expiresIso = new Date(expiresAtMs).toISOString();
  const nowIso = new Date().toISOString();

  console.log(`[session-manager] saveTokenToDb: Saving token ${token.slice(0, 20)}... expires at ${expiresIso}`);

  try {
    // Usar UPDATE direto ao invés de UPSERT
    const { data, error } = await supabase
      .from("blaze_auth_cache")
      .update({
        token,
        expires_hint: expiresIso,
        last_refreshed_at: nowIso,
        last_validated_at: nowIso,
        username: username || null,
        credits: typeof credits === "number" ? credits : null,
        refresh_lock_until: null,
      })
      .eq("id", "singleton")
      .select("token, expires_hint")
      .single();

    if (error) {
      console.error("[session-manager] saveTokenToDb update ERROR:", error.message, error.code, error.details);
      
      // Se não existe, fazer insert
      if (error.code === 'PGRST116') {
        const { error: insertError } = await supabase
          .from("blaze_auth_cache")
          .insert({
            id: "singleton",
            token,
            expires_hint: expiresIso,
            last_refreshed_at: nowIso,
            last_validated_at: nowIso,
            username: username || null,
            credits: typeof credits === "number" ? credits : null,
            refresh_lock_until: null,
          });
        if (insertError) {
          console.error("[session-manager] saveTokenToDb insert ERROR:", insertError.message);
        } else {
          console.log(`[session-manager] Token INSERTED to DB, expires: ${expiresIso}`);
        }
      }
    } else {
      console.log(`[session-manager] Token UPDATED in DB. Token: ${data?.token?.slice(0, 20)}..., expires: ${data?.expires_hint}`);
    }
  } catch (e) {
    console.error("[session-manager] saveTokenToDb EXCEPTION:", e);
  }
}

// ==================== MARCAR TOKEN COMO POSSIVELMENTE EXPIRADO ====================
// (mantido apenas para compatibilidade; não força re-login automaticamente)
async function markTokenMaybeExpired(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    // Apenas marca o "last_validated_at" (schema atual não possui maybe_expired)
    await supabase
      .from("blaze_auth_cache")
      .update({ last_validated_at: new Date().toISOString() })
      .eq("id", "singleton");
  } catch {
    // ignore
  }
}

// ==================== CALCULAR EXPIRAÇÃO DO TOKEN ====================
function calculateTokenExpiry(token: string): number {
  try {
    const parts = token.split(".");
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1]));
      if (payload.exp) {
        return payload.exp * 1000;
      }
    }
  } catch {}
  
  // Default: 1 hora
  return Date.now() + 60 * 60 * 1000;
}

// ==================== PROXY SUPPORT PARA LOGIN ====================
function getProxyList(panelConfig?: SigmaPanelConfig | null): string[] {
  // Priorizar proxy do painel, depois env var
  const raw = (panelConfig?.proxy_url || Deno.env.get("RESIDENTIAL_PROXY_URL") || "").trim();
  if (!raw) return [];
  return raw.split(",").map(p => {
    const trimmed = p.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `http://${trimmed}`;
  }).filter(p => {
    try { return new URL(p).protocol.startsWith("http"); } catch { return false; }
  });
}

function getProxyClient(proxyUrl: string): Deno.HttpClient | null {
  try {
    return Deno.createHttpClient({ proxy: { url: proxyUrl } });
  } catch { return null; }
}

function looksLikeCloudflareBlock(body: string): boolean {
  const b = body.toLowerCase();
  return b.includes("cdn-cgi/challenge") || b.includes("just a moment") || b.includes("cloudflare ray id");
}

/**
 * Perform login usando credenciais do painel ativo
 */
async function performLogin(panelConfig: SigmaPanelConfig): Promise<{ token: string; expiresAt: number; username?: string; credits?: number }> {
  const { base_url, username, password, cf_clearance } = panelConfig;

  if (!base_url || !username || !password) {
    throw new Error("Painel Sigma não possui credenciais configuradas");
  }

  const baseUrl = normalizeBlazeBaseUrl(base_url);
  const loginUrls = [
    joinBlazeUrl(baseUrl, "/api/auth/login"),
    joinBlazeUrl(baseUrl, "/auth/login"),
  ];
  const cfCookie = cf_clearance || Deno.env.get("BLAZE_CF_CLEARANCE");
  const proxies = getProxyList(panelConfig);
  const MAX_RETRIES_PER_PROXY = 3;

  console.log(`[session-manager] Performing login for panel "${panelConfig.name}" (proxies: ${proxies.length}, cf_clearance: ${cfCookie ? 'yes' : 'no'})...`);

  const buildHeaders = (): Record<string, string> => {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      "Origin": new URL(baseUrl).origin,
      "Referer": new URL(baseUrl).origin + "/",
      "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="131", "Google Chrome";v="131"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
    };
    if (cfCookie) h["Cookie"] = `cf_clearance=${cfCookie}`;
    return h;
  };

  const attemptLogin = async (url: string, client?: Deno.HttpClient): Promise<Response> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      // Add human-like delay before request
      await new Promise(r => setTimeout(r, Math.floor(Math.random() * 500) + 200));
      
      const fetchOptions: RequestInit & { client?: Deno.HttpClient } = {
        method: "POST",
        signal: controller.signal,
        headers: buildHeaders(),
        body: JSON.stringify({ username, password }),
      };
      if (client) (fetchOptions as any).client = client;
      return await fetch(url, fetchOptions);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        throw new Error("LOGIN_TIMEOUT:408:Timeout ao logar no Sigma Blaze");
      }
      throw e;
    } finally {
      clearTimeout(timeout);
    }
  };

  const errors: string[] = [];

  // SEMPRE usar proxy residencial para login quando disponível
  if (proxies.length > 0) {
    for (const proxyUrl of proxies) {
      for (let retry = 0; retry < MAX_RETRIES_PER_PROXY; retry++) {
        const client = getProxyClient(proxyUrl);
        if (!client) continue;

        for (const loginUrl of loginUrls) {
          try {
            console.log(`[session-manager] Login attempt ${retry + 1}/${MAX_RETRIES_PER_PROXY} via proxy to ${loginUrl}...`);
            const response = await attemptLogin(loginUrl, client);
            
            // Se for 404, tentar próximo endpoint
            if (response.status === 404) {
              console.log(`[session-manager] Endpoint ${loginUrl} returned 404, trying next...`);
              continue;
            }

            // Verificar se é resposta OK
            if (response.ok) {
              console.log(`[session-manager] Login successful via proxy on attempt ${retry + 1}`);
              const result = await parseLoginResponse(response, loginUrl);
              await updatePanelToken(panelConfig.id, result.token, new Date(result.expiresAt));
              return result;
            }

            // Verificar tipo de resposta para diagnóstico
            const contentType = response.headers.get("content-type") || "";
            const text = await response.text();
            
            // Se for Cloudflare block, tentar novamente com delay
            if (contentType.includes("text/html") && looksLikeCloudflareBlock(text)) {
              console.log(`[session-manager] Cloudflare challenge detected on attempt ${retry + 1}, retrying with delay...`);
              errors.push(`Proxy attempt ${retry + 1}: Cloudflare block`);
              await new Promise(r => setTimeout(r, 2000 * (retry + 1)));
              break; // Sair do loop de endpoints, tentar próximo retry
            }

            // Se for erro de credenciais, não adianta tentar novamente
            if (response.status === 401 || response.status === 422) {
              throw new Error(`LOGIN_INVALID_CREDENTIALS:${response.status}:Credenciais inválidas. ${text.slice(0, 200)}`);
            }

            // Outros erros
            errors.push(`Proxy attempt ${retry + 1}: HTTP ${response.status} - ${text.slice(0, 100)}`);
            
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            // Se for erro de credenciais, propagar imediatamente
            if (msg.includes("LOGIN_INVALID_CREDENTIALS")) throw e;
            
            console.log(`[session-manager] Proxy login attempt ${retry + 1} failed: ${msg}`);
            errors.push(`Proxy attempt ${retry + 1}: ${msg.slice(0, 100)}`);
          }
        }

        // Delay entre retries
        if (retry < MAX_RETRIES_PER_PROXY - 1) {
          await new Promise(r => setTimeout(r, 1000 * (retry + 1)));
        }
      }
    }

    // Se chegou aqui, todos os proxies falharam - NÃO fazer fallback para direto
    // pois sabemos que será bloqueado pelo Cloudflare
    console.error(`[session-manager] All proxy login attempts failed. Errors: ${errors.join('; ')}`);
    throw new Error(`PROXY_LOGIN_FAILED:502:Todas as tentativas de login via proxy falharam. O Cloudflare está bloqueando. Verifique se os proxies residenciais estão funcionando ou atualize o BLAZE_CF_CLEARANCE. Erros: ${errors.slice(-3).join('; ')}`);
  }

  // Sem proxy configurado - tentar direto (provavelmente será bloqueado)
  console.log(`[session-manager] No proxies configured, trying direct login...`);
  
  for (const loginUrl of loginUrls) {
    try {
      const response = await attemptLogin(loginUrl);
      if (response.status === 404) continue;
      
      const result = await parseLoginResponse(response, loginUrl);
      await updatePanelToken(panelConfig.id, result.token, new Date(result.expiresAt));
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("CLOUDFLARE_BLOCKED")) {
        throw new Error("CLOUDFLARE_BLOCKED:403:Sem proxy residencial configurado e Cloudflare está bloqueando. Configure RESIDENTIAL_PROXY_URL com um proxy residencial válido.");
      }
      if (msg.includes("LOGIN_INVALID_CREDENTIALS")) throw e;
      errors.push(`Direct: ${msg.slice(0, 100)}`);
    }
  }

  throw new Error(`LOGIN_FAILED:500:Todas as tentativas de login falharam. Erros: ${errors.slice(-3).join('; ')}`);
}

async function parseLoginResponse(response: Response, loginUrl: string): Promise<{ token: string; expiresAt: number; username?: string; credits?: number }> {
  if (!response.ok) {
    const text = await response.text();
    const contentType = response.headers.get("content-type") || "";
    
    // Só considerar Cloudflare block se for HTML com indicadores específicos
    const isHtml = contentType.includes("text/html");
    if (isHtml && looksLikeCloudflareBlock(text)) {
      throw new Error(`CLOUDFLARE_BLOCKED:403:Acesso bloqueado pelo Cloudflare. Atualize BLAZE_CF_CLEARANCE ou use um proxy residencial.`);
    }
    
    // 401 = Token/credenciais inválidos (NÃO é Cloudflare)
    if (response.status === 401) {
      throw new Error(`LOGIN_INVALID_CREDENTIALS:401:Credenciais inválidas ou token expirado. Verifique usuário/senha do painel Sigma. ${text.slice(0, 200)}`);
    }
    
    if (response.status === 429) {
      throw new Error(`LOGIN_RATE_LIMITED:429:${text.slice(0, 200)}`);
    }
    
    // 403 JSON = credenciais inválidas, não Cloudflare
    if (response.status === 403 && !isHtml) {
      throw new Error(`LOGIN_FORBIDDEN:403:Acesso negado pelo servidor. Verifique credenciais. ${text.slice(0, 200)}`);
    }
    
    if (response.status === 422 || response.status === 403) {
      throw new Error(`LOGIN_INVALID_CREDENTIALS:${response.status}:${text.slice(0, 200)}`);
    }
    throw new Error(`LOGIN_FAILED:${response.status}:${loginUrl}:${text.slice(0, 200)}`);
  }

  const data = await response.json();

  const token =
    data.accessToken ||
    data.access_token ||
    data.token ||
    data.jwt ||
    data.data?.accessToken ||
    data.data?.access_token ||
    data.data?.token;

  if (!token || typeof token !== "string") {
    throw new Error(`LOGIN_NO_TOKEN: Response keys: ${Object.keys(data).join(", ")}`);
  }

  const expiresAt = calculateTokenExpiry(token);

  console.log(
    `[session-manager] Login successful, token length: ${token.length}, expires: ${new Date(expiresAt).toISOString()}`
  );

  return {
    token,
    expiresAt,
    username: data.username || data.user?.username,
    credits: data.credits ?? data.user?.credits,
  };
}

// ==================== RENOVAR TOKEN EM BACKGROUND ====================
async function renewTokenInBackground(panelConfig: SigmaPanelConfig): Promise<void> {
  if (isRenewing) {
    console.log("[session-manager] Already renewing, skipping...");
    return;
  }

  const now = Date.now();
  if (now - lastLoginAttempt < SESSION_CONFIG.MIN_LOGIN_INTERVAL_MS) {
    console.log("[session-manager] Renewal skipped due to login cooldown");
    return;
  }

  // Contabilizar como uma tentativa de login (evita spam)
  lastLoginAttempt = now;
  isRenewing = true;

  try {
    console.log(`[session-manager] Starting background token renewal for panel "${panelConfig.name}"...`);
    
    const result = await performLogin(panelConfig);
    
    // Salvar no banco (compatibilidade com blaze_auth_cache)
    await saveTokenToDb(result.token, result.expiresAt, result.username, result.credits);
    
    // Atualizar cache em memória
    cachedToken = { token: result.token, expiresAt: result.expiresAt };

    await logSessionEvent({
      event: "token_renewed",
      reason: `Proactive renewal for panel ${panelConfig.name}`,
      newExpiry: new Date(result.expiresAt),
    });

    console.log(`[session-manager] Background renewal complete, new expiry: ${new Date(result.expiresAt).toISOString()}`);
  } catch (e) {
    console.warn("[session-manager] Background renewal failed:", e);
    await updatePanelLoginError(panelConfig.id, e instanceof Error ? e.message : String(e));
    await logSessionEvent({
      event: "renewal_failed",
      reason: e instanceof Error ? e.message : String(e),
    });
  } finally {
    isRenewing = false;
  }
}

// ==================== FUNÇÃO PRINCIPAL: getSigmaSession ====================
/**
 * FUNÇÃO CENTRAL - Obtém token válido para usar nas requisições.
 * 
 * Novo fluxo multi-painel:
 * 1. Busca painel ativo do banco (sigma_panels) por tenantId
 * 2. Verifica token existente no painel (current_token)
 * 3. Se token está perto de expirar, renova
 * 4. Se token expirado ou inexistente, faz login
 * 5. Retorna token válido
 */
export async function getSigmaSession(opts: { forceLogin?: boolean; tenantId?: string | null } = {}): Promise<SigmaSessionResult> {
  const { forceLogin = false, tenantId = null } = opts;
  const now = Date.now();

  // ==================== 1. BUSCAR PAINEL ATIVO ====================
  const panelConfig = await getActivePanelConfig(tenantId);
  if (!panelConfig) {
    throw new Error("Nenhum painel Sigma ativo configurado. Configure um painel em /admin/sigma-blaze.");
  }

  // Guardar config atual para uso em outras funções
  currentPanelConfig = panelConfig;

  console.log(`[session-manager] Using panel "${panelConfig.name}" (${panelConfig.id}) for tenant ${tenantId || 'global'}`);

  // ==================== 2. CACHE EM MEMÓRIA ====================
  if (!forceLogin && cachedToken) {
    let expiresIn = cachedToken.expiresAt - now;

    // Token ainda válido
    if (expiresIn > 0) {
      // Se perto de expirar, renovar AGORA
      if (expiresIn < SESSION_CONFIG.PROACTIVE_RENEWAL_MARGIN_MS && !isRenewing) {
        console.log(
          `[session-manager] Token expiring soon (${Math.round(expiresIn / 60000)} min), renewing now...`
        );
        await renewTokenInBackground(panelConfig);
        expiresIn = (cachedToken?.expiresAt || 0) - now;
      }

      console.log(`[session-manager] Using cached token (expires in ${Math.round(expiresIn / 60000)} min)`);

      return {
        accessToken: cachedToken.token,
        cookies: {},
        headersProntos: buildSessionHeaders(cachedToken.token),
        session: buildSessionObject(cachedToken.token, cachedToken.expiresAt),
      };
    }
  }

  // ==================== 3. BUSCAR TOKEN DO PAINEL ====================
  // Primeiro, tenta usar o token salvo no próprio painel
  if (!forceLogin && panelConfig.current_token && panelConfig.token_expires_at) {
    const tokenExpiresAt = new Date(panelConfig.token_expires_at).getTime();
    const expiresIn = tokenExpiresAt - now;

    if (expiresIn > 0) {
      cachedToken = { token: panelConfig.current_token, expiresAt: tokenExpiresAt };

      // Se perto de expirar, renova agora
      if (expiresIn < SESSION_CONFIG.PROACTIVE_RENEWAL_MARGIN_MS && !isRenewing) {
        console.log(`[session-manager] Panel token near expiry (${Math.round(expiresIn / 60000)} min), renewing now...`);
        await renewTokenInBackground(panelConfig);
      }

      const effective = cachedToken;
      console.log(`[session-manager] Using token from panel (expires in ${Math.round((effective.expiresAt - now) / 60000)} min)`);

      return {
        accessToken: effective.token,
        cookies: {},
        headersProntos: buildSessionHeaders(effective.token),
        session: buildSessionObject(effective.token, effective.expiresAt),
      };
    }
  }

  // ==================== 4. BUSCAR DO BANCO (compatibilidade) ====================
  const dbToken = await getTokenFromDb();
  const staticToken = (Deno.env.get("SIGMA_AUTH_TOKEN") || "").trim();

  if (!forceLogin && dbToken?.token) {
    let expiresIn = dbToken.expiresAt - now;

    if (expiresIn <= 0) {
      console.log(`[session-manager] DB token expired, forcing login path...`);
      cachedToken = null;
    } else {
      cachedToken = { token: dbToken.token, expiresAt: dbToken.expiresAt };

      if (expiresIn < SESSION_CONFIG.PROACTIVE_RENEWAL_MARGIN_MS && !isRenewing) {
        console.log(`[session-manager] DB token near expiry, renewing now...`);
        await renewTokenInBackground(panelConfig);
      }

      const effective = cachedToken || { token: dbToken.token, expiresAt: dbToken.expiresAt };

      return {
        accessToken: effective.token,
        cookies: {},
        headersProntos: buildSessionHeaders(effective.token),
        session: buildSessionObject(effective.token, effective.expiresAt),
      };
    }
  }

  // Token estático (evita login)
  if (!forceLogin && staticToken) {
    const expiresAt = now + 60 * 60 * 1000;
    cachedToken = { token: staticToken, expiresAt };
    console.log("[session-manager] Using SIGMA_AUTH_TOKEN (static token)");

    return {
      accessToken: staticToken,
      cookies: {},
      headersProntos: buildSessionHeaders(staticToken),
      session: buildSessionObject(staticToken, expiresAt),
    };
  }

  // ==================== 5. SEM TOKEN - FAZER LOGIN ====================
  if (!forceLogin && now - lastLoginAttempt < SESSION_CONFIG.MIN_LOGIN_INTERVAL_MS) {
    if (dbToken?.token && dbToken.expiresAt > now) {
      cachedToken = { token: dbToken.token, expiresAt: dbToken.expiresAt };
      return {
        accessToken: dbToken.token,
        cookies: {},
        headersProntos: buildSessionHeaders(dbToken.token),
        session: buildSessionObject(dbToken.token, dbToken.expiresAt),
      };
    }

    if (staticToken) {
      const expiresAt = now + 60 * 60 * 1000;
      cachedToken = { token: staticToken, expiresAt };
      return {
        accessToken: staticToken,
        cookies: {},
        headersProntos: buildSessionHeaders(staticToken),
        session: buildSessionObject(staticToken, expiresAt),
      };
    }

    throw new Error("LOGIN_COOLDOWN:429:Aguarde alguns segundos antes de tentar novamente");
  }

  lastLoginAttempt = now;

  console.log(`[session-manager] No usable token available, performing login for panel "${panelConfig.name}"...`);

  await logSessionEvent({
    event: "login_started",
    reason: forceLogin ? "Forced login" : `No usable token for panel ${panelConfig.name}`,
  });

  try {
    const result = await performLogin(panelConfig);

    // Salvar no banco (compatibilidade)
    await saveTokenToDb(result.token, result.expiresAt, result.username, result.credits);

    cachedToken = { token: result.token, expiresAt: result.expiresAt };

    await logSessionEvent({
      event: "login_success",
      reason: `New token obtained for panel ${panelConfig.name}`,
      newExpiry: new Date(result.expiresAt),
    });

    return {
      accessToken: result.token,
      cookies: {},
      headersProntos: buildSessionHeaders(result.token),
      session: buildSessionObject(result.token, result.expiresAt),
    };
  } catch (e) {
    await updatePanelLoginError(panelConfig.id, e instanceof Error ? e.message : String(e));
    await logSessionEvent({
      event: "login_failed",
      reason: e instanceof Error ? e.message : String(e),
    });

    if (forceLogin) {
      throw e;
    }

    // Fallback
    if (dbToken?.token) {
      await markTokenMaybeExpired();
      cachedToken = { token: dbToken.token, expiresAt: dbToken.expiresAt };
      return {
        accessToken: dbToken.token,
        cookies: {},
        headersProntos: buildSessionHeaders(dbToken.token),
        session: buildSessionObject(dbToken.token, dbToken.expiresAt),
      };
    }

    if (staticToken) {
      const expiresAt = now + 60 * 60 * 1000;
      cachedToken = { token: staticToken, expiresAt };
      return {
        accessToken: staticToken,
        cookies: {},
        headersProntos: buildSessionHeaders(staticToken),
        session: buildSessionObject(staticToken, expiresAt),
      };
    }

    throw e;
  }
}

// Getter para obter o painel atual (útil para index.ts)
export function getCurrentPanelConfig(): SigmaPanelConfig | null {
  return currentPanelConfig;
}

// ==================== HELPER: BUILD SESSION OBJECT ====================
function buildSessionObject(token: string, expiresAt: number): SigmaSession {
  return {
    id: "singleton",
    provider: SESSION_CONFIG.PROVIDER,
    accessToken: token,
    refreshToken: null,
    sessionCookie: {},
    expiresAt: new Date(expiresAt),
    lastValidatedAt: new Date(),
    isActive: true,
    userId: null,
    username: null,
    credits: null,
    uaFingerprint: USER_AGENT,
    sessionHeaders: {},
  };
}

// ==================== FAIL-SAFE WRAPPER ====================
/**
 * Wrapper para requisições com fail-safe automático.
 * Se receber 401/403, força re-login e tenta novamente.
 */
export async function withFailSafe<T>(
  fn: (session: SigmaSessionResult) => Promise<T>,
  retryCount = 0
): Promise<T> {
  const session = await getSigmaSession({ forceLogin: retryCount > 0 });

  try {
    return await fn(session);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isAuthError = 
      msg.includes("401") || 
      msg.includes("403") || 
      msg.toLowerCase().includes("unauthorized") ||
      msg.toLowerCase().includes("invalid jwt") ||
      msg.toLowerCase().includes("token");

    if (isAuthError && retryCount < 2) {
      console.log(`[session-manager] Auth error detected (retry ${retryCount + 1}), forcing re-login...`);
      
      // Limpar cache
      cachedToken = null;
      await markTokenMaybeExpired();
      
      // Esperar um pouco antes de retry
      await new Promise(r => setTimeout(r, 1000));
      
      return withFailSafe(fn, retryCount + 1);
    }

    throw e;
  }
}

// ==================== EXPORTS ====================
export {
  getTokenFromDb,
  saveTokenToDb,
  markTokenMaybeExpired,
};

// Re-export panel config type
export type { SigmaPanelConfig } from "./panel-config.ts";
