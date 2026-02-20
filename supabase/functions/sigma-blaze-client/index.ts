// sigma-blaze v3.0 - Refactored for bundle size
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { getSigmaSession, buildSessionHeaders, humanDelay, logSessionEvent, SESSION_CONFIG, getCurrentPanelConfig } from "./session-manager.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ==================== UTILITIES ====================
function getSupabaseServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key);
}

function normalizeBlazeBaseUrl(raw: string): string {
  try {
    const u = new URL(raw);
    const path = u.pathname.replace(/\/+$/, "");
    const apiMatch = path.match(/^(.*\/api)/i);
    return apiMatch ? `${u.origin}${apiMatch[1]}` : u.origin;
  } catch {
    return raw.replace(/\/+$/, "");
  }
}

function joinBlazeUrl(baseUrl: string, endpoint: string): string {
  const b = baseUrl.replace(/\/+$/, "");
  let e = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  if (b.endsWith("/api") && e.toLowerCase().startsWith("/api")) e = e.slice(4);
  return `${b}${e}`;
}

function parseAuthHeader(rawToken: string): { tokenType: string; token: string; headerValue: string } {
  const t = (rawToken || "").trim();
  if (!t) return { tokenType: "Bearer", token: "", headerValue: "Bearer" };
  const withSpace = t.match(/^([A-Za-z]+)\s+(.+)$/);
  if (withSpace) {
    const tokenType = "Bearer";
    const token = (withSpace[2] || "").trim();
    return { tokenType, token, headerValue: `${tokenType} ${token}` };
  }
  return { tokenType: "Bearer", token: t, headerValue: `Bearer ${t}` };
}

function computeTokenExpiresAtMs(rawToken: string, fallbackMs: number): number {
  try {
    const parts = rawToken.split(".");
    if (parts.length >= 2) {
      const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
      const payload = JSON.parse(atob(b64));
      if (typeof payload.exp === "number") return payload.exp * 1000;
    }
  } catch {}
  return Date.now() + fallbackMs;
}

// ==================== ME HELPERS (credits/username) ====================
function extractMeInfo(payload: any): { username: string | null; credits: number | null } {
  const p0 = payload?.data ?? payload;
  const user = p0?.user ?? p0?.data?.user ?? p0?.profile ?? null;

  const username =
    (typeof p0?.username === "string" && p0.username) ||
    (typeof user?.username === "string" && user.username) ||
    (typeof p0?.email === "string" && p0.email) ||
    (typeof user?.email === "string" && user.email) ||
    (typeof p0?.name === "string" && p0.name) ||
    (typeof user?.name === "string" && user.name) ||
    null;

  const rawCredits =
    p0?.credits ??
    p0?.credit ??
    p0?.credit_balance ??
    p0?.creditBalance ??
    user?.credits ??
    user?.credit ??
    user?.credit_balance ??
    p0?.balance ??
    p0?.wallet_balance ??
    p0?.walletBalance ??
    p0?.data?.credits ??
    p0?.data?.credit ??
    null;

  const creditsNum = typeof rawCredits === "number" ? rawCredits : rawCredits != null ? Number(rawCredits) : NaN;
  const credits = Number.isFinite(creditsNum) ? creditsNum : null;

  return { username, credits };
}

async function ensureMeData(opts: {
  token: string;
  baseUrl?: string;
  supabase?: ReturnType<typeof getSupabaseServiceClient> | null;
  updateCache?: boolean; // blaze_auth_cache (apenas master/legado)
}): Promise<{ username: string | null; credits: number | null } | null> {
  const token = String(opts.token || "").trim();
  if (!token) return null;

  // Prioridade: baseUrl explícita → painel atual → env (legado/master)
  const panel = getCurrentPanelConfig();
  const rawBase = (opts.baseUrl || panel?.base_url || Deno.env.get("SIGMA_BLAZE_API_URL") || "").trim();
  if (!rawBase) return null;

  const baseUrl = normalizeBlazeBaseUrl(rawBase);

  try {
    // Fonte oficial de créditos é /api/auth/me
    const me = await blazeRequestWithToken(baseUrl, "Bearer", token, "/api/auth/me", "GET");
    const info = extractMeInfo(me);

    // Atualiza blaze_auth_cache apenas quando explicitamente pedido (legado/master)
    if (opts.supabase && opts.updateCache) {
      const patch: Record<string, unknown> = {
        last_validated_at: new Date().toISOString(),
      };

      if (info.username) patch.username = info.username;
      if (info.credits !== null) patch.credits = info.credits;

      try {
        await opts.supabase.from("blaze_auth_cache").update(patch).eq("id", "singleton");
      } catch (e) {
        console.warn("[ensureMeData] Failed to update blaze_auth_cache:", e);
      }
    }

    return info;
  } catch (e) {
    console.warn("[ensureMeData] Failed to fetch /api/auth/me:", e);
    return null;
  }
}

// ==================== PROXY SUPPORT ====================
let proxyClients: Map<string, Deno.HttpClient> = new Map();
let currentWorkingProxy: string | null = null;
let proxyFailCounts: Map<string, number> = new Map();
let proxySuccessCounts: Map<string, number> = new Map();
let totalRequestCount = 0;
let successRequestCount = 0;

function normalizeProxyUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  
  // Handle proxy-seller format: user:pass:host:port or user:pass@host:port
  if (!trimmed.includes("@")) {
    // Format: user:pass:host:port - find the host by looking for a domain-like segment
    const parts = trimmed.split(":");
    if (parts.length === 4) {
      // user:pass:host:port
      return `http://${parts[0]}:${parts[1]}@${parts[2]}:${parts[3]}`;
    }
    if (parts.length === 3) {
      // Could be user:pass:host (no port) or host:port:something
      // Try to detect: if last part is numeric, it's likely host:port with user
      if (/^\d+$/.test(parts[2])) {
        // host:port format without auth - just add protocol
        return `http://${trimmed}`;
      }
      return `http://${parts[0]}:${parts[1]}@${parts[2]}`;
    }
  }
  
  return `http://${trimmed}`;
}

function getProxyList(): string[] {
  const raw = (Deno.env.get("RESIDENTIAL_PROXY_URL") || "").trim();
  if (!raw) return [];

  const all = raw
    .split(",")
    .map((p) => normalizeProxyUrl(p))
    .filter((p) => {
      if (!p) return false;
      try {
        return new URL(p).protocol.startsWith("http");
      } catch {
        return false;
      }
    });

  // Deduplicar URLs idênticas
  return [...new Set(all)];
}

function maskProxyUrl(proxyUrl: string): string {
  // Mostrar URL completa para debug
  return proxyUrl;
}

function getProxyClient(proxyUrl: string): Deno.HttpClient | null {
  if (proxyClients.has(proxyUrl)) return proxyClients.get(proxyUrl) || null;
  try {
    const client = Deno.createHttpClient({ proxy: { url: proxyUrl } });
    proxyClients.set(proxyUrl, client);
    return client;
  } catch { return null; }
}

function getBlazeHeaders(targetUrl?: string): Record<string, string> {
  const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
  let origin = "https://blaze.officeb.site";
  if (targetUrl) try { origin = new URL(targetUrl).origin; } catch {}
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8",
    "User-Agent": ua,
    "Origin": origin,
    "Referer": `${origin}/`,
  };
  const cf = Deno.env.get("BLAZE_CF_CLEARANCE");
  if (cf) h["Cookie"] = `cf_clearance=${cf}`;
  return h;
}

async function fetchWithTimeout(url: string, init: any, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...init, signal: controller.signal }); }
  finally { clearTimeout(t); }
}

function looksLikeCloudflareBlock(body: string): boolean {
  const b = body.toLowerCase();
  return b.includes("cdn-cgi/challenge") || b.includes("just a moment") || b.includes("cloudflare ray id");
}

// Função para logar performance do proxy no banco
async function logProxyPerformance(
  proxyUrl: string,
  targetEndpoint: string,
  success: boolean,
  latencyMs: number,
  httpStatus?: number,
  errorType?: string
): Promise<void> {
  try {
    const supabase = getSupabaseServiceClient();
    if (!supabase) return;
    
    await supabase.from("proxy_performance_logs").insert({
      proxy_url_full: proxyUrl, // URL completa com credenciais
      proxy_url_masked: proxyUrl.replace(/\/\/[^@]+@/, "//"), // Versão sem credenciais para compatibilidade
      target_endpoint: targetEndpoint.slice(0, 500),
      success,
      latency_ms: latencyMs,
      http_status: httpStatus,
      error_type: errorType?.slice(0, 100),
      retry_count: 0,
    });
  } catch (e) {
    console.warn("[logProxyPerformance] Failed to log:", e);
  }
}
// Calcula a taxa de sucesso de um proxy baseado nos contadores em memória
function getProxySuccessRate(proxyUrl: string): number {
  const successes = proxySuccessCounts.get(proxyUrl) || 0;
  const failures = proxyFailCounts.get(proxyUrl) || 0;
  const total = successes + failures;
  // Se não há histórico, assume 100% para dar chance ao proxy
  if (total === 0) return 100;
  return (successes / total) * 100;
}

// Ordena os proxies por taxa de sucesso (melhor primeiro)
function getProxiesSortedBySuccessRate(): string[] {
  const proxies = getProxyList();
  return proxies.sort((a, b) => {
    const rateA = getProxySuccessRate(a);
    const rateB = getProxySuccessRate(b);
    // Ordenar do maior para o menor
    return rateB - rateA;
  });
}

async function blazeFetch(url: string, init: any, retry = 0): Promise<Response> {
  // Ordenar proxies por taxa de sucesso (melhor primeiro)
  const proxies = getProxiesSortedBySuccessRate();
  const maxRetries = 3;
  totalRequestCount++;

  if (proxies.length > 0) {
    for (const proxyUrl of proxies) {
      const client = getProxyClient(proxyUrl);
      if (!client) continue;

      const startTime = Date.now();
      try {
        const response = await fetchWithTimeout(url, { ...init, client }, 20000);
        const latencyMs = Date.now() - startTime;

        // Cloudflare challenge (HTML) deve ser tratado como falha de proxy e tentar o próximo
        const contentType = response.headers.get("content-type") || "";
        if (response.status === 403 && contentType.includes("text/html")) {
          const preview = (await response.clone().text()).slice(0, 2000);
          if (looksLikeCloudflareBlock(preview)) {
            proxyFailCounts.set(proxyUrl, (proxyFailCounts.get(proxyUrl) || 0) + 1);
            logProxyPerformance(proxyUrl, url, false, latencyMs, 403, "cloudflare_block");
            continue;
          }
        }

        currentWorkingProxy = proxyUrl;
        proxySuccessCounts.set(proxyUrl, (proxySuccessCounts.get(proxyUrl) || 0) + 1);
        successRequestCount++;
        logProxyPerformance(proxyUrl, url, true, latencyMs, response.status);
        return response;
      } catch (e) {
        const latencyMs = Date.now() - startTime;
        proxyFailCounts.set(proxyUrl, (proxyFailCounts.get(proxyUrl) || 0) + 1);
        logProxyPerformance(proxyUrl, url, false, latencyMs, undefined, e instanceof Error ? e.message.slice(0, 50) : "unknown");
      }
    }

    if (retry < maxRetries) {
      await new Promise((r) => setTimeout(r, 2000 * (retry + 1)));
      return blazeFetch(url, init, retry + 1);
    }

    throw new Error(`PROXY_ALL_FAILED:502:All ${proxies.length} proxies failed`);
  }

  try {
    const response = await fetchWithTimeout(url, init, 20000);

    const contentType = response.headers.get("content-type") || "";
    if (response.status === 403 && contentType.includes("text/html")) {
      const preview = (await response.clone().text()).slice(0, 2000);
      if (looksLikeCloudflareBlock(preview)) {
        throw new Error(
          "CLOUDFLARE_BLOCKED:403:Cloudflare bloqueou a requisição. Verifique RESIDENTIAL_PROXY_URL e/ou atualize BLAZE_CF_CLEARANCE."
        );
      }
    }

    successRequestCount++;
    return response;
  } catch (e) {
    if (retry < maxRetries) return blazeFetch(url, init, retry + 1);
    throw new Error(`CONNECT_FAILED:502:${e instanceof Error ? e.message : String(e)}`);
  }
}

// Contexto de tenant da request atual (definido no handler)
let currentRequestTenantId: string | null = null;

// ==================== BLAZE REQUEST ====================
async function blazeRequest(endpoint: string, method = "GET", body?: unknown, retryCount = 0): Promise<unknown> {
  // Buscar sessão com base no tenant da request atual
  const session = await getSigmaSession({ forceLogin: retryCount > 0, tenantId: currentRequestTenantId });
  
  // Usar base_url do painel ativo (não mais env var fixa)
  const panelConfig = getCurrentPanelConfig();
  if (!panelConfig) throw new Error("Nenhum painel Sigma ativo configurado");

  const baseUrl = normalizeBlazeBaseUrl(panelConfig.base_url);
  const fullUrl = joinBlazeUrl(baseUrl, endpoint);
  
  await humanDelay();

  let response: Response;
  try {
    const headers = { ...session.headersProntos };
    try { const u = new URL(fullUrl); headers["Origin"] = u.origin; headers["Referer"] = `${u.origin}/`; } catch {}
    
    response = await blazeFetch(fullUrl, { method, headers, body: body ? JSON.stringify(body) : undefined });
    
    if (response.status === 404 && endpoint.toLowerCase().startsWith("/api/")) {
      const altUrl = joinBlazeUrl(baseUrl, endpoint.replace(/^\/api\//i, "/"));
      response = await blazeFetch(altUrl, { method, headers, body: body ? JSON.stringify(body) : undefined });
    }
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : String(e));
  }

  const responseText = await response.text();
  let responseBody: unknown = null;
  try { responseBody = responseText ? JSON.parse(responseText) : null; } catch { responseBody = responseText; }

  if (!response.ok) {
    if ((response.status === 401 || response.status === 403) && retryCount < 2) {
      await new Promise(r => setTimeout(r, 1000));
      return blazeRequest(endpoint, method, body, retryCount + 1);
    }
    throw new Error(`BLAZE_API_ERROR:${response.status}:${endpoint}: ${responseText.slice(0, 200)}`);
  }

  return responseBody;
}

async function blazeRequestWithToken(baseUrl: string, tokenType: string, token: string, endpoint: string, method = "GET"): Promise<unknown> {
  const fullUrl = joinBlazeUrl(baseUrl, endpoint);
  const resp = await blazeFetch(fullUrl, { method, headers: { ...getBlazeHeaders(fullUrl), Authorization: `${tokenType} ${token}` } });
  
  if (resp.status === 404 && endpoint.toLowerCase().startsWith("/api/")) {
    const altResp = await blazeFetch(joinBlazeUrl(baseUrl, endpoint.replace(/^\/api\//i, "/")), { method, headers: { ...getBlazeHeaders(fullUrl), Authorization: `${tokenType} ${token}` } });
    const text = await altResp.text();
    if (!altResp.ok) throw new Error(`Blaze ${method} ${endpoint} failed: ${altResp.status}`);
    try { return JSON.parse(text); } catch { return text; }
  }
  
  const text = await resp.text();
  if (!resp.ok) throw new Error(`Blaze ${method} ${endpoint} failed: ${resp.status}`);
  try { return JSON.parse(text); } catch { return text; }
}

// ==================== MAIN HANDLER ====================
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, forceLogin: forceLoginParam, tenantId, ...params } = await req.json();

    const requestTenantId = typeof tenantId === "string" && tenantId.trim() ? tenantId.trim() : null;

    // Definir tenant da request atual para uso em blazeRequest / getSigmaSession
    currentRequestTenantId = requestTenantId;

    // Verificar se existe configuração válida (painel ativo OU env vars)
    const hasEnvConfig = !!(Deno.env.get("SIGMA_BLAZE_API_URL") || "").trim() 
                      && !!(Deno.env.get("SIGMA_BLAZE_USERNAME") || "").trim();
    
    // tenantMissing só é true se não há tenant E não há env vars de fallback
    const tenantMissing = !requestTenantId && !hasEnvConfig;

    const isNoPanelError = (e: unknown) =>
      String(e instanceof Error ? e.message : e).includes("Nenhum painel Sigma ativo configurado");

    let result: unknown;

    switch (action) {
      case "config_status": {
        const apiUrl = (Deno.env.get("SIGMA_BLAZE_API_URL") || "").trim();
        const username = (Deno.env.get("SIGMA_BLAZE_USERNAME") || "").trim();
        const passwordConfigured = !!(Deno.env.get("SIGMA_BLAZE_PASSWORD") || "").trim();
        const authTokenConfigured = !!(Deno.env.get("SIGMA_AUTH_TOKEN") || "").trim();

        result = {
          apiUrl,
          username,
          passwordConfigured,
          authTokenConfigured,
        };
        break;
      }

      case "diagnostic_status": {
        const now = Date.now();
        const apiUrl = (Deno.env.get("SIGMA_BLAZE_API_URL") || "").trim();
        const proxyUrl = (Deno.env.get("RESIDENTIAL_PROXY_URL") || "").trim();
        const supabase = getSupabaseServiceClient();

        const secrets = {
          api_url: !!apiUrl,
          username: !!(Deno.env.get("SIGMA_BLAZE_USERNAME") || "").trim(),
          password: !!(Deno.env.get("SIGMA_BLAZE_PASSWORD") || "").trim(),
          auth_token: !!(Deno.env.get("SIGMA_AUTH_TOKEN") || "").trim(),
          proxy: !!proxyUrl,
        };

        // Default auth_block (mantido para compatibilidade com o painel)
        const auth_block = {
          blocked: false,
          until: undefined,
          remaining_min: undefined,
          reason: undefined,
          last_status: undefined,
        };

        // Proxy stats (in-memory - sessão atual)
        const proxyStatsMemory = getProxyList().map((p) => {
          const failures = proxyFailCounts.get(p) || 0;
          const successes = proxySuccessCounts.get(p) || 0;
          const total = failures + successes;
          const successRate = total > 0 ? Math.round((successes / total) * 100) : 0;
          return {
            proxy: maskProxyUrl(p),
            failures,
            successes,
            successRate,
          };
        });

        // Proxy stats histórico total (do banco de dados) - apenas para proxies atuais
        const currentProxies = getProxyList();
        const proxyStatsHistory: Array<{
          proxy: string;
          proxy_display: string;
          total_requests: number;
          total_success: number;
          total_errors: number;
          success_rate: number;
        }> = [];
        
        // Função para extrair host:porta de uma URL de proxy (para matching por IP)
        const extractHostPort = (proxyUrl: string): string => {
          try {
            // Se começa com http/https, é uma URL válida
            if (proxyUrl.startsWith('http://') || proxyUrl.startsWith('https://')) {
              const url = new URL(proxyUrl);
              return `${url.hostname}:${url.port || (url.protocol === 'https:' ? '443' : '80')}`;
            }
            // Se é apenas host:port (sem protocolo)
            const match = proxyUrl.match(/^([^:]+):(\d+)/);
            if (match) return `${match[1]}:${match[2]}`;
            return proxyUrl;
          } catch {
            // Fallback: tentar extrair manualmente do formato user:pass@host:port
            const match = proxyUrl.match(/@([^@:\/]+):(\d+)/);
            if (match) return `${match[1]}:${match[2]}`;
            // Tentar formato simples host:port
            const simpleMatch = proxyUrl.match(/([^:\/]+):(\d+)/);
            if (simpleMatch) return `${simpleMatch[1]}:${simpleMatch[2]}`;
            return proxyUrl;
          }
        };
        
        // Totais para o card de taxa de sucesso geral
        let totalProxyRequests = 0;
        let totalProxySuccess = 0;
        
        if (supabase && currentProxies.length > 0) {
          try {
            // Buscar histórico de todos os proxies
            const { data: historyData } = await supabase
              .from("proxy_performance_logs")
              .select("proxy_url_full, proxy_url_masked, success")
              .order("created_at", { ascending: false })
              .limit(50000);
            
            // Agregar por URL completa (para registros novos)
            const aggregatedByFullUrl = new Map<string, { total: number; success: number; errors: number }>();
            // Agregar por host:porta (para registros antigos sem proxy_url_full)
            const aggregatedByHostPort = new Map<string, { total: number; success: number; errors: number }>();
            
            if (historyData) {
              for (const row of historyData) {
                const proxyFull = row.proxy_url_full;
                const proxyMasked = row.proxy_url_masked || "";
                
                if (proxyFull) {
                  // Registro novo com URL completa - agregar pela URL completa
                  const current = aggregatedByFullUrl.get(proxyFull) || { total: 0, success: 0, errors: 0 };
                  current.total++;
                  if (row.success) current.success++; else current.errors++;
                  aggregatedByFullUrl.set(proxyFull, current);
                } else if (proxyMasked) {
                  // Registro antigo sem URL completa - agregar por host:porta extraído do masked
                  // O masked está no formato: http://host:port ou https://host:port
                  const hostPort = extractHostPort(proxyMasked);
                  const current = aggregatedByHostPort.get(hostPort) || { total: 0, success: 0, errors: 0 };
                  current.total++;
                  if (row.success) current.success++; else current.errors++;
                  aggregatedByHostPort.set(hostPort, current);
                }
              }
            }
            
            // Para cada proxy configurado atualmente, buscar suas estatísticas
            for (const proxyUrl of currentProxies) {
              // Primeiro tenta match exato pela URL completa
              let stats = aggregatedByFullUrl.get(proxyUrl);
              let matchType = stats ? "full_url" : "none";
              
              // Se não encontrou por URL completa, faz fallback por host:porta
              if (!stats || stats.total === 0) {
                const currentHostPort = extractHostPort(proxyUrl);
                const hostPortStats = aggregatedByHostPort.get(currentHostPort);
                
                if (hostPortStats) {
                  // Combinar estatísticas da URL completa (se existem) com as do host:porta
                  if (stats && stats.total > 0) {
                    stats = {
                      total: stats.total + hostPortStats.total,
                      success: stats.success + hostPortStats.success,
                      errors: stats.errors + hostPortStats.errors,
                    };
                    matchType = "combined";
                  } else {
                    stats = hostPortStats;
                    matchType = "host_port";
                  }
                }
              }
              
              // Acumular para o total geral
              if (stats) {
                totalProxyRequests += stats.total;
                totalProxySuccess += stats.success;
              }
              
              proxyStatsHistory.push({
                proxy: proxyUrl,
                proxy_display: proxyUrl, // URL completa com credenciais
                total_requests: stats?.total || 0,
                total_success: stats?.success || 0,
                total_errors: stats?.errors || 0,
                success_rate: stats && stats.total > 0 
                  ? Math.round((stats.success / stats.total) * 100 * 10) / 10 
                  : 0,
              });
            }
          } catch (e) {
            console.warn("[diagnostic_status] Failed to fetch proxy history:", e);
            // Adicionar proxies sem histórico
            for (const proxyUrl of currentProxies) {
              proxyStatsHistory.push({
                proxy: proxyUrl,
                proxy_display: proxyUrl,
                total_requests: 0,
                total_success: 0,
                total_errors: 0,
                success_rate: 0,
              });
            }
          }
        }
        
        // Calcular taxa de sucesso geral baseada no histórico total dos proxies atuais
        const overallProxySuccessRate = totalProxyRequests > 0 
          ? Math.round((totalProxySuccess / totalProxyRequests) * 100) 
          : 0;

        let cacheRow: any = null;
        if (supabase) {
          const { data } = await supabase
            .from("blaze_auth_cache")
            .select("token, expires_hint, last_refreshed_at, username, credits, refresh_lock_until")
            .eq("id", "singleton")
            .maybeSingle();
          cacheRow = data;
        }

        // Se o token veio de "set_db_token", username/credits podem estar vazios. Faz um refresh rápido via /api/auth/me.
        if (supabase && cacheRow?.token && (cacheRow.credits === null || cacheRow.credits === undefined || !cacheRow.username)) {
          const refreshed = await ensureMeData({ token: String(cacheRow.token), supabase });
          if (refreshed) {
            cacheRow = { ...cacheRow, ...refreshed };
          }
        }

        const hintedExpMs = cacheRow?.expires_hint ? new Date(String(cacheRow.expires_hint)).getTime() : 0;
        const refreshedAtMs = cacheRow?.last_refreshed_at ? new Date(String(cacheRow.last_refreshed_at)).getTime() : 0;
        const expiresAtMs = hintedExpMs || (refreshedAtMs ? refreshedAtMs + 60 * 60 * 1000 : 0);
        const expiresInMs = expiresAtMs ? expiresAtMs - now : NaN;
        const expiresInMin = Number.isFinite(expiresInMs) ? Math.round(expiresInMs / 60000) : null;

        const lockUntilMs = cacheRow?.refresh_lock_until ? new Date(String(cacheRow.refresh_lock_until)).getTime() : 0;
        const lockActive = lockUntilMs && lockUntilMs > now;

        // AUTO-RENEW: se está perto de expirar, força renovação 1x usando lock no DB
        let autoRenew = { attempted: false, locked: lockActive, ok: true as boolean, error: null as string | null };
         const shouldRenew =
           !!cacheRow?.token &&
           (!Number.isFinite(expiresInMs) || expiresInMs <= SESSION_CONFIG.PROACTIVE_RENEWAL_MARGIN_MS);

        if (supabase && shouldRenew && !lockActive) {
          autoRenew.attempted = true;
          try {
            // lock curto para evitar spam em cold starts
            await supabase
              .from("blaze_auth_cache")
              .update({ refresh_lock_until: new Date(now + 90 * 1000).toISOString() })
              .eq("id", "singleton");

            // força login agora (renova token imediatamente)
            await getSigmaSession({ forceLogin: true, tenantId: currentRequestTenantId });

            // re-fetch para devolver dados atualizados
            const { data: fresh } = await supabase
              .from("blaze_auth_cache")
              .select("token, expires_hint, last_refreshed_at, username, credits, refresh_lock_until")
              .eq("id", "singleton")
              .maybeSingle();
            cacheRow = fresh;
          } catch (e) {
            autoRenew.ok = false;
            autoRenew.error = e instanceof Error ? e.message : String(e);
          }
        }

        // Construir token payload compatível com BlazeDiagnosticPanel
        let tokenPayload: any = { source: "none", valid: false };
        if (cacheRow?.token) {
          const hintedExpMs2 = cacheRow?.expires_hint ? new Date(String(cacheRow.expires_hint)).getTime() : 0;
          const refreshedAtMs2 = cacheRow?.last_refreshed_at ? new Date(String(cacheRow.last_refreshed_at)).getTime() : 0;
          const expiresAtMs2 = hintedExpMs2 || (refreshedAtMs2 ? refreshedAtMs2 + 60 * 60 * 1000 : 0);
          const expiresInMs2 = expiresAtMs2 ? expiresAtMs2 - now : NaN;

          tokenPayload = {
            source: "blaze_auth_cache",
            valid: Number.isFinite(expiresInMs2) ? expiresInMs2 > 0 : false,
            expires_at: expiresAtMs2 ? new Date(expiresAtMs2).toISOString() : undefined,
            expires_in_min: Number.isFinite(expiresInMs2) ? Math.round(expiresInMs2 / 60000) : undefined,
            last_refresh: cacheRow.last_refreshed_at || undefined,
            username: cacheRow.username || undefined,
            credits: typeof cacheRow.credits === "number" ? cacheRow.credits : undefined,
            auto_renewal: autoRenew,
          };
        }

        result = {
          timestamp: new Date().toISOString(),
          api_url: apiUrl || null,
          base_url: apiUrl ? normalizeBlazeBaseUrl(apiUrl) : null,
          token: tokenPayload,
          auth_block,
          proxy: {
            configured: !!proxyUrl,
            count: getProxyList().length,
            active: currentWorkingProxy ? maskProxyUrl(currentWorkingProxy) : null,
            stats: proxyStatsMemory,
            history: proxyStatsHistory,
          },
          requests: {
            total: totalProxyRequests || totalRequestCount,
            success: totalProxySuccess || successRequestCount,
            success_rate: totalProxyRequests > 0 
              ? overallProxySuccessRate 
              : (totalRequestCount > 0 ? Math.round((successRequestCount / totalRequestCount) * 100) : 0),
          },
          secrets,
        };
        break;
      }

      case "get_token_status": {
        const supabase = getSupabaseServiceClient();
        if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");

        const { data: cache } = await supabase
          .from("blaze_auth_cache")
          .select("token, username, credits, expires_hint, last_refreshed_at, refresh_lock_until")
          .eq("id", "singleton")
          .maybeSingle();

        if (!cache?.token) {
          result = { has_token: false, message: "Nenhum token configurado" };
          break;
        }

        const now = Date.now();
        const expiresAt = cache.expires_hint ? new Date(cache.expires_hint).getTime() : 0;
        const timeUntilExpiry = expiresAt - now;

        const lockUntilMs = cache.refresh_lock_until ? new Date(cache.refresh_lock_until).getTime() : 0;
        const lockActive = lockUntilMs && lockUntilMs > now;

        // Se estiver perto de expirar OU já expirou, tenta renovar automaticamente (com lock curto)
        const shouldRenew = (!Number.isFinite(timeUntilExpiry) ? true : timeUntilExpiry <= SESSION_CONFIG.PROACTIVE_RENEWAL_MARGIN_MS);
        let autoRenewalAttempted = false;

        if (shouldRenew && !lockActive) {
          autoRenewalAttempted = true;
          try {
            await supabase
              .from("blaze_auth_cache")
              .update({ refresh_lock_until: new Date(now + 90 * 1000).toISOString() })
              .eq("id", "singleton");

            // força renovação via session-manager
            await getSigmaSession({ forceLogin: true, tenantId: currentRequestTenantId });
          } catch (e) {
            console.warn("[get_token_status] auto-renew failed:", e);
          }
        }

        // Recarrega para refletir renovação (se aconteceu)
        const { data: cache2 } = await supabase
          .from("blaze_auth_cache")
          .select("token, username, credits, expires_hint, last_refreshed_at")
          .eq("id", "singleton")
          .maybeSingle();

        const effective = cache2 || cache;
        const expiresAt2 = effective?.expires_hint ? new Date(String(effective.expires_hint)).getTime() : expiresAt;
        const timeUntilExpiry2 = expiresAt2 - Date.now();

        // Se credits/username não estiverem no cache (ex: token colado manualmente), buscar via /api/auth/me e atualizar o cache.
        if (effective?.token && (effective.credits === null || effective.credits === undefined || !effective.username)) {
          const refreshed = await ensureMeData({ token: String(effective.token), supabase });
          if (refreshed) {
            (effective as any).username = (effective as any).username || refreshed.username;
            (effective as any).credits = (effective as any).credits ?? refreshed.credits;
          }
        }

        result = {
          has_token: true,
          token_preview: String(effective.token).slice(0, 20) + "...",
          username: effective.username,
          credits: effective.credits,
          expires_at: effective.expires_hint,
          last_refreshed_at: effective.last_refreshed_at,
          time_until_expiry_min: Math.round(timeUntilExpiry2 / 60000),
          is_expired: timeUntilExpiry2 <= 0,
          status: timeUntilExpiry2 <= 0 ? "expired" : timeUntilExpiry2 <= 900000 ? "near_expiry" : "valid",
          auto_renewal_attempted: autoRenewalAttempted,
        };
        break;
      }

      case "renew_token": {
        const supabase = getSupabaseServiceClient();
        if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");

        // Libera lock para permitir renovação imediata
        await supabase.from("blaze_auth_cache").update({ refresh_lock_until: null }).eq("id", "singleton");

        console.log("[renew_token] Starting forced login...");

        // Força um re-login usando o session-manager
        const session = await getSigmaSession({ forceLogin: true, tenantId: currentRequestTenantId });
        const newToken = session.accessToken;
        const newExpiresAt = session.session.expiresAt;

        console.log("[renew_token] Login completed, new token:", newToken?.slice(0, 20) + "..., expires:", newExpiresAt.toISOString());

        // Salvar token DIRETAMENTE no banco (bypass do session-manager que pode estar falhando)
        const nowIso = new Date().toISOString();
        const expiresIso = newExpiresAt.toISOString();

        const { error: updateError } = await supabase
          .from("blaze_auth_cache")
          .update({
            token: newToken,
            expires_hint: expiresIso,
            last_refreshed_at: nowIso,
            last_validated_at: nowIso,
            refresh_lock_until: null,
          })
          .eq("id", "singleton");

        if (updateError) {
          console.error("[renew_token] Failed to update token in DB:", updateError.message);
        } else {
          console.log("[renew_token] Token saved to DB successfully!");
        }

        // Atualiza credits/username em tempo real
        await ensureMeData({ token: newToken, supabase });

        // Ler cache atualizado
        const { data: cache } = await supabase
          .from("blaze_auth_cache")
          .select("expires_hint, username, credits")
          .eq("id", "singleton")
          .maybeSingle();

        const expiresAtMs = new Date(String(cache?.expires_hint || expiresIso)).getTime();

        result = {
          ok: true,
          new_expires_at: cache?.expires_hint || expiresIso,
          new_time_until_expiry_min: Math.round((expiresAtMs - Date.now()) / 60000),
          username: cache?.username ?? null,
          credits: cache?.credits ?? null,
          message: "Token renovado com sucesso!",
        };
        break;
      }

      case "set_db_token": {
        const rawToken = String((params as any)?.token || "").trim();
        if (!rawToken) throw new Error("Token vazio");
        const supabase = getSupabaseServiceClient();
        if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
        const parsed = parseAuthHeader(rawToken);
        const expiresAtMs = computeTokenExpiresAtMs(parsed.token, 3600000);
        await supabase.from("blaze_auth_cache").upsert({ id: "singleton", token: parsed.token, expires_hint: new Date(expiresAtMs).toISOString(), last_refreshed_at: new Date().toISOString(), refresh_lock_until: null }, { onConflict: "id" });
        result = { ok: true, token_type: parsed.tokenType, expires_at: new Date(expiresAtMs).toISOString(), message: "Token salvo" };
        break;
      }

      case "get_me": {
        // Segurança: sem tenantId não retornamos dados do master
        if (tenantMissing) {
          result = {
            token: null,
            token_type: "Bearer",
            source: "tenant_missing",
            username: null,
            credits: 0,
          };
          break;
        }

        try {
          const session = await getSigmaSession({
            forceLogin: !!forceLoginParam,
            tenantId: currentRequestTenantId,
          });

          const panel = getCurrentPanelConfig();
          const sbClient = getSupabaseServiceClient();
          const updateCache = panel?.id === "__env__";

          // Sempre tenta buscar em tempo real no painel do tenant
          const realtime = panel?.base_url
            ? await ensureMeData({
                token: session.accessToken,
                baseUrl: panel.base_url,
                supabase: sbClient,
                updateCache,
              })
            : null;

          result = {
            token: session.accessToken,
            token_type: "Bearer",
            source: realtime ? "api_auth_me" : "no_realtime",
            username: realtime?.username ?? null,
            credits: realtime?.credits ?? 0,
          };
        } catch (e) {
          if (isNoPanelError(e)) {
            result = {
              token: null,
              token_type: "Bearer",
              source: "no_panel",
              username: null,
              credits: 0,
            };
            break;
          }
          throw e;
        }

        break;
      }

      case "refresh_credits": {
        if (tenantMissing) {
          result = {
            credits: 0,
            username: null,
            source: "tenant_missing",
            updated_at: new Date().toISOString(),
          };
          break;
        }

        try {
          const session = await getSigmaSession({
            forceLogin: false,
            tenantId: currentRequestTenantId,
          });

          const panel = getCurrentPanelConfig();
          if (!panel?.base_url) {
            throw new Error("Nenhum painel Sigma ativo configurado");
          }

          let credits: number | null = null;
          let username: string | null = null;
          let creditsSource = "not_found";

          const baseUrl = normalizeBlazeBaseUrl(panel.base_url);
          const endpoints = [{ path: "/api/auth/me", extractor: extractMeInfo }];

          for (const ep of endpoints) {
            try {
              const resp = await blazeRequestWithToken(baseUrl, "Bearer", session.accessToken, ep.path, "GET");
              const info = ep.extractor(resp);
              if (info.credits !== null) {
                credits = info.credits;
                username = info.username || username;
                creditsSource = ep.path;
                break;
              }
              if (info.username) username = info.username;
            } catch (e) {
              console.log(`[refresh_credits] ${ep.path} failed:`, e instanceof Error ? e.message : String(e));
            }
          }

          // blaze_auth_cache é global (legado). Só atualizamos quando estiver usando env/master.
          const sbClient = getSupabaseServiceClient();
          if (sbClient && panel.id === "__env__" && credits !== null) {
            await sbClient
              .from("blaze_auth_cache")
              .update({
                credits,
                username: username || undefined,
                last_validated_at: new Date().toISOString(),
              })
              .eq("id", "singleton");
          }

          result = {
            credits: credits ?? 0,
            username,
            source: creditsSource,
            updated_at: new Date().toISOString(),
          };
        } catch (e) {
          if (isNoPanelError(e)) {
            result = {
              credits: 0,
              username: null,
              source: "no_panel",
              updated_at: new Date().toISOString(),
            };
            break;
          }
          throw e;
        }

        break;
      }

      case "list_customers": {
        const { page = 1, perPage = 20, filters = {} } = params;

        if (tenantMissing) {
          result = {
            data: [],
            meta: { total: 0, page: Number(page) || 1, perPage: Number(perPage) || 20, lastPage: 1 },
          };
          break;
        }

        const queryParams = new URLSearchParams({ page: String(page), perPage: String(perPage), ...filters });

        try {
          result = await blazeRequest(`/api/customers?${queryParams}`);
        } catch (e) {
          if (isNoPanelError(e)) {
            result = {
              data: [],
              meta: { total: 0, page: Number(page) || 1, perPage: Number(perPage) || 20, lastPage: 1 },
            };
            break;
          }
          throw e;
        }

        break;
      }

      case "list_all_customers": {
        // Busca TODOS os clientes em uma única chamada de edge function
        // Reutiliza a mesma sessão/proxy para todas as páginas (muito mais rápido)
        if (tenantMissing) {
          result = { data: [], total: 0, cached: false };
          break;
        }

        const useCache = params?.useCache !== false;
        const supabaseClient = getSupabaseServiceClient();

        // 1. Tentar servir do cache primeiro (sigma_blaze_clients)
        if (useCache && supabaseClient) {
          try {
            const { data: cachedClients, error: cacheErr } = await supabaseClient
              .from("sigma_blaze_clients")
              .select("*")
              .order("expiration_date", { ascending: true });

            if (!cacheErr && cachedClients && cachedClients.length > 0) {
              // Verificar se o cache é recente (menos de 10 minutos)
              const newestUpdate = cachedClients.reduce((max, c) => {
                const t = new Date(c.updated_at || c.created_at || 0).getTime();
                return t > max ? t : max;
              }, 0);
              const cacheAgeMs = Date.now() - newestUpdate;

              if (cacheAgeMs < 10 * 60 * 1000) {
                console.log(`[list_all_customers] Serving ${cachedClients.length} clients from DB cache (age: ${Math.round(cacheAgeMs / 1000)}s)`);
                result = { data: cachedClients, total: cachedClients.length, cached: true, cacheAgeMs };
                break;
              }
            }
          } catch (e) {
            console.warn("[list_all_customers] Cache read failed:", e);
          }
        }

        // 2. Buscar do painel Sigma (todas as páginas na mesma sessão)
        try {
          const allCustomers: any[] = [];
          let currentPage = 1;
          const batchSize = 100;
          let hasMore = true;

          while (hasMore && currentPage <= 15) {
            const qp = new URLSearchParams({ page: String(currentPage), perPage: String(batchSize) });
            try {
              const pageResult = await blazeRequest(`/api/customers?${qp}`) as any;
              const customers = pageResult?.data || [];
              if (customers.length === 0) break;
              allCustomers.push(...customers);

              const lastPage = pageResult?.meta?.last_page || pageResult?.meta?.lastPage || 1;
              hasMore = currentPage < lastPage;
              currentPage++;
            } catch (pageErr) {
              console.warn(`[list_all_customers] Page ${currentPage} failed, using ${allCustomers.length} partial results`);
              break;
            }
          }

          console.log(`[list_all_customers] Fetched ${allCustomers.length} customers from ${currentPage - 1} pages`);

          // 3. Salvar no cache (sigma_blaze_clients) em background
          if (supabaseClient && allCustomers.length > 0) {
            // Fire and forget - não bloqueia a resposta
            (async () => {
              try {
                const nowIso = new Date().toISOString();
                const rows = allCustomers.map((c: any) => ({
                  sigma_id: String(c.id || c.client_id || c.user_id || ""),
                  name: c.name || c.username || c.nome || "Sem nome",
                  whatsapp: c.whatsapp || c.phone || c.telefone || c.cel || "",
                  email: c.email || c.e_mail || "",
                  plan_name: c.package || c.plan_name || c.package_name || c.plano || c.plan || "Blaze IPTV",
                  plan_value: parseFloat(c.plan_price || c.plan_value || c.package_value || c.valor || c.price || "0") || 0,
                  expiration_date: c.expires_at || c.expiration_date || c.exp_date || c.data_expiracao || c.due_date || nowIso,
                  status: (c.status === "EXPIRED" || c.status === "inactive" || c.status === "disabled" || c.status === "blocked") ? "inactive" : "active",
                  notes: c.note || c.notes || c.obs || c.observacao || null,
                  updated_at: nowIso,
                })).filter((r: any) => r.sigma_id);

                // Upsert em lotes de 200
                for (let i = 0; i < rows.length; i += 200) {
                  const batch = rows.slice(i, i + 200);
                  await supabaseClient
                    .from("sigma_blaze_clients")
                    .upsert(batch, { onConflict: "sigma_id" });
                }
                console.log(`[list_all_customers] Cached ${rows.length} customers to DB`);
              } catch (e) {
                console.warn("[list_all_customers] Cache write failed:", e);
              }
            })();
          }

          result = { data: allCustomers, total: allCustomers.length, cached: false };
        } catch (e) {
          if (isNoPanelError(e)) {
            result = { data: [], total: 0, cached: false };
            break;
          }
          throw e;
        }

        break;
      }

      case "get_customer": {
        const { customerId } = params;
        result = await blazeRequest(`/api/customers/${customerId}`);
        break;
      }

      case "create_customer": {
        const username = params?.username;
        const password = params?.password;
        const serverId = params?.serverId ?? params?.server_id;
        const packageId = params?.packageId ?? params?.package_id;
        const connections = params?.connections ?? 1;
        const note = params?.note ?? params?.notes;
        const isTrial = params?.isTrial ?? params?.is_trial ?? false;
        
        // Dados do cliente para WhatsApp
        const customerName = params?.name;
        const customerEmail = params?.email;
        const customerWhatsapp = params?.whatsapp;
        const userId = params?.user_id; // user_id do profiles (se veio do renew)
        const fromRenew = params?.from_renew === true; // Flag para disparar WhatsApp apenas no renew

        // server_id e package_id são obrigatórios
        // username e password são OPCIONAIS - se não passados, o painel Sigma gera automaticamente
        if (!serverId || !packageId) {
          throw new Error("create_customer requires: server_id, package_id");
        }

        const payload: Record<string, unknown> = {
          server_id: serverId,
          package_id: packageId,
          connections,
          is_trial: isTrial,
        };
        
        // Só inclui username/password se foram passados
        // Caso contrário, deixa o painel Sigma gerar automaticamente
        if (username) payload.username = username;
        if (password) payload.password = password;
        
        if (note) {
          // Alguns painéis usam note, outros notes. Enviamos ambos para compatibilidade.
          payload.note = note;
          payload.notes = note;
        }

        const blazeCustomer = await blazeRequest("/api/customers", "POST", payload);

        // Extrair username/password do cliente criado (o painel pode ter gerado automaticamente)
        const bc = blazeCustomer as any;
        const finalUsername = username || bc?.username || bc?.data?.username;
        const finalPassword = password || bc?.password || bc?.data?.password;

        // Se o admin selecionou MaxPlayer no form, criar também o cliente MaxPlayer vinculado ao pacote.
        const maxplayerServerId = params?.maxplayerServerId ?? params?.maxplayer_server_id;
        const maxplayerPackageId = params?.maxplayerPackageId ?? params?.maxplayer_package_id;

        let maxplayerCustomer: unknown = null;
        // Só tenta criar MaxPlayer se temos username/password (do input ou gerado pelo painel)
        if (maxplayerServerId && maxplayerPackageId && finalUsername && finalPassword) {
          const mpPayload: Record<string, unknown> = {
            username: finalUsername,
            password: finalPassword,
            server_id: maxplayerServerId,
            package_id: maxplayerPackageId,
            connections: 1,
            is_trial: false,
          };

          const mpNote = note ? `${note} | MaxPlayer` : "MaxPlayer";
          mpPayload.note = mpNote;
          mpPayload.notes = mpNote;

          try {
            maxplayerCustomer = await blazeRequest("/api/customers", "POST", mpPayload);
          } catch (e) {
            console.warn("[create_customer] MaxPlayer creation failed:", e instanceof Error ? e.message : String(e));
            // Não falha a operação principal se MaxPlayer falhar
          }
        }

        if (maxplayerCustomer) {
          if (typeof blazeCustomer === "object" && blazeCustomer !== null) {
            result = { ...(blazeCustomer as any), maxplayer: maxplayerCustomer };
          } else {
            result = { data: blazeCustomer, maxplayer: maxplayerCustomer };
          }
        } else {
          result = blazeCustomer;
        }

        // ========== TRIGGER WHATSAPP: Enviar notificações apenas quando veio do RENEW ==========
        // Só dispara se o cliente foi criado com sucesso E veio do fluxo de renew
        if (fromRenew && blazeCustomer && typeof blazeCustomer === "object") {
          const supabase = getSupabaseServiceClient();
          
          if (supabase) {
            // Preparar variáveis extras para os templates
            const extraVariables: Record<string, string> = {
              blaze_username: finalUsername || "",
              blaze_password: finalPassword || "",
              customer_name: customerName || finalUsername || "",
              customer_email: customerEmail || "",
              customer_whatsapp: customerWhatsapp || "",
              is_trial: isTrial ? "Sim" : "Não",
              package_id: String(packageId),
              server_id: String(serverId),
            };

            // Adicionar dados do cliente Blaze retornado
            const bc = blazeCustomer as any;
            if (bc.m3u_url) extraVariables.m3u_url = bc.m3u_url;
            if (bc.m3u_url_short) extraVariables.m3u_url_short = bc.m3u_url_short;
            if (bc.renew_url) extraVariables.renew_url = bc.renew_url;
            if (bc.expires_at) extraVariables.expires_at = bc.expires_at;
            if (bc.package) extraVariables.package_name = bc.package;
            if (bc.server) extraVariables.server_name = bc.server;

            // Se tiver userId (veio do renew/signup), usar para buscar dados do perfil
            // Caso contrário, criar um "fake" user_id baseado no whatsapp para as automações funcionarem
            let effectiveUserId = userId;
            
            if (!effectiveUserId && customerWhatsapp) {
              // Tentar encontrar usuário pelo WhatsApp
              const { data: profile } = await supabase
                .from("profiles")
                .select("id")
                .eq("whatsapp", customerWhatsapp)
                .maybeSingle();
              
              if (profile?.id) {
                effectiveUserId = profile.id;
              }
            }

            // Disparar evento para USUÁRIO (sigma.customer_created)
            if (effectiveUserId) {
              console.log(`[create_customer] Triggering WhatsApp event sigma.customer_created for user: ${effectiveUserId}`);
              
              try {
                await supabase.functions.invoke("trigger-whatsapp-event", {
                  body: {
                    event_type: "sigma.customer_created",
                    user_id: effectiveUserId,
                    extra_variables: extraVariables,
                  },
                });
              } catch (e) {
                console.warn("[create_customer] WhatsApp trigger failed (user):", e);
              }
            }

            // Disparar evento para ADMIN (sigma.customer_created.admin)
            console.log(`[create_customer] Triggering WhatsApp event sigma.customer_created.admin`);
            
            try {
              // Para admin, usamos o userId se existir, ou criamos um placeholder
              const adminUserId = effectiveUserId || "00000000-0000-0000-0000-000000000000";
              
              await supabase.functions.invoke("trigger-whatsapp-event", {
                body: {
                  event_type: "sigma.customer_created.admin",
                  user_id: adminUserId,
                  extra_variables: extraVariables,
                },
              });
            } catch (e) {
              console.warn("[create_customer] WhatsApp trigger failed (admin):", e);
            }
          }
        }

        break;
      }

      case "update_customer": {
        const { customerId, ...updateData } = params;
        const normalizedData: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(updateData)) {
          normalizedData[key === 'package_id' ? 'packageId' : key === 'server_id' ? 'serverId' : key] = value;
        }
        result = await blazeRequest(`/api/customers/${customerId}`, "PUT", normalizedData);
        break;
      }

      case "delete_customer": {
        const { customerId } = params;
        result = await blazeRequest(`/api/customers/${customerId}`, "DELETE");
        break;
      }

      case "renew_customer": {
        const { customerId, packageId, durationDays } = params;
        const renewBody: Record<string, unknown> = {};
        if (packageId) renewBody.package_id = packageId;
        if (durationDays) renewBody.duration = durationDays;
        result = await blazeRequest(`/api/customers/${customerId}/renew`, "POST", renewBody);
        break;
      }

      case "list_servers": {
        if (tenantMissing) {
          result = { data: [] };
          break;
        }

        try {
          result = await blazeRequest("/api/servers");
        } catch (e) {
          if (isNoPanelError(e)) {
            result = { data: [] };
            break;
          }
          throw e;
        }
        break;
      }

      case "list_packages": {
        if (tenantMissing) {
          result = { data: [] };
          break;
        }

        try {
          const { page = 1, perPage } = params as Record<string, unknown>;
          const queryParams = new URLSearchParams({ page: String(page) });
          if (perPage) queryParams.set("perPage", String(perPage));
          const response = await blazeRequest(`/api/packages/price?${queryParams}`);
          result = (response as any)?.data ?? response;
        } catch (e) {
          if (isNoPanelError(e)) {
            result = { data: [] };
            break;
          }
          throw e;
        }
        break;
      }

      case "online_count": {
        if (tenantMissing) {
          result = { count: 0 };
          break;
        }

        try {
          result = await blazeRequest("/api/users/online-count");
        } catch (e) {
          if (isNoPanelError(e)) {
            result = { count: 0 };
            break;
          }
          throw e;
        }
        break;
      }

      case "list_live_connections": {
        const { server_id, per_page = 100, page = 1, keyword = "" } = params;
        
        // URL correta conforme documentação: /api/customers/live-connections/{server_id}
        // Exemplo: https://blaze.officeb.site/api/customers/live-connections/BV4D3rLaqZ?page=1&keyword=&perPage=20
        const queryParams = new URLSearchParams({
          page: String(page),
          perPage: String(per_page),
          keyword: keyword || "",
        });
        
        const endpoint = `/api/customers/live-connections/${server_id}?${queryParams}`;
        console.log(`[list_live_connections] Fetching from: ${endpoint}`);
        
        try {
          const liveData = await blazeRequest(endpoint);
          
          // Verificar se a resposta é válida (não HTML)
          if (liveData && typeof liveData === "object" && !String(liveData).includes("<!DOCTYPE")) {
            console.log(`[list_live_connections] Success! Found ${(liveData as any)?.data?.length || 0} connections`);
            result = liveData;
          } else {
            console.log(`[list_live_connections] Invalid response from ${endpoint}`);
            result = { data: [], meta: { total: 0 }, endpoint_used: endpoint };
          }
        } catch (e) {
          console.error(`[list_live_connections] Error from ${endpoint}:`, e instanceof Error ? e.message : String(e));
          result = { data: [], meta: { total: 0 }, error: e instanceof Error ? e.message : String(e) };
        }
        break;
      }

      case "probe_proxy": {
        const proxies = getProxyList();
        const proxyTests: Array<{ proxy: string; ok: boolean; error?: string }> = [];
        for (const proxyUrl of proxies) {
          try {
            const client = getProxyClient(proxyUrl);
            if (!client) { proxyTests.push({ proxy: maskProxyUrl(proxyUrl), ok: false, error: "client_failed" }); continue; }
            const r = await fetchWithTimeout("https://api.ipify.org?format=json", { method: "GET", client }, 15000);
            proxyTests.push({ proxy: maskProxyUrl(proxyUrl), ok: r.ok, error: r.ok ? undefined : `http_${r.status}` });
          } catch (e) {
            proxyTests.push({ proxy: maskProxyUrl(proxyUrl), ok: false, error: e instanceof Error ? e.message.slice(0, 50) : "unknown" });
          }
        }
        result = { proxyConfigured: proxies.length > 0, proxyCount: proxies.length, proxyTests, currentWorkingProxy: currentWorkingProxy ? maskProxyUrl(currentWorkingProxy) : null };
        break;
      }

      case "test-proxies": {
        const proxies = getProxyList();
        const results: Array<{ proxy: string; ok: boolean; latencyMs: number; ip?: string; error?: string }> = [];
        for (const proxyUrl of proxies) {
          const start = Date.now();
          try {
            const client = getProxyClient(proxyUrl);
            if (!client) {
              proxyFailCounts.set(proxyUrl, (proxyFailCounts.get(proxyUrl) || 0) + 1);
              results.push({ proxy: maskProxyUrl(proxyUrl), ok: false, latencyMs: 0, error: "client_failed" });
              continue;
            }

            const r = await fetchWithTimeout("https://ip.oxylabs.io/location", { method: "GET", client }, 15000);
            const latencyMs = Date.now() - start;

            if (!r.ok) {
              proxyFailCounts.set(proxyUrl, (proxyFailCounts.get(proxyUrl) || 0) + 1);
              results.push({ proxy: maskProxyUrl(proxyUrl), ok: false, latencyMs, error: `http_${r.status}` });
              continue;
            }

            const text = await r.text();
            let ip: string | undefined;
            try {
              ip = JSON.parse(text).ip || text.trim().split("\n")[0];
            } catch {
              ip = text.trim();
            }

            proxySuccessCounts.set(proxyUrl, (proxySuccessCounts.get(proxyUrl) || 0) + 1);
            if (!currentWorkingProxy) currentWorkingProxy = proxyUrl;

            results.push({ proxy: maskProxyUrl(proxyUrl), ok: true, latencyMs, ip });
          } catch (e) {
            proxyFailCounts.set(proxyUrl, (proxyFailCounts.get(proxyUrl) || 0) + 1);
            results.push({ proxy: maskProxyUrl(proxyUrl), ok: false, latencyMs: Date.now() - start, error: e instanceof Error ? e.message.slice(0, 50) : "unknown" });
          }
        }

        const total = results.length;
        const working = results.filter((r) => r.ok).length;
        const failed = results.filter((r) => !r.ok).length;
        const working_percent = total > 0 ? Math.round((working / total) * 100) : 0;

        result = { results, summary: { total, working, failed, working_percent } };
        break;
      }

      case "upsert_customer": {
        const { userId, serverId, packageId, planDurationDays, price, isTrial, username, password, blazeId, source } = params;
        if (!userId || !serverId || !packageId || !username || !password) throw new Error("upsert_customer requires: userId, serverId, packageId, username, password");
        const supabase = getSupabaseServiceClient();
        if (!supabase) throw new Error("Failed to get Supabase client");
        const { data: upsertResult, error: upsertError } = await supabase.rpc('upsert_customer_by_server', { p_user_id: userId, p_server_id: serverId, p_package_id: packageId, p_plan_duration_days: planDurationDays || 30, p_price: price || 0, p_is_trial: isTrial || false, p_username: username, p_password: password, p_source: source || 'api', p_blaze_id: blazeId || null });
        if (upsertError) throw new Error(`RPC failed: ${upsertError.message}`);
        result = upsertResult;
        break;
      }

      case "create_trial_playlist": {
        const { userId, username, password, serverId, packageId } = params;
        if (!userId || !serverId || !username || !password) throw new Error("create_trial_playlist requires: userId, serverId, username, password");
        const supabase = getSupabaseServiceClient();
        if (!supabase) throw new Error("Failed to get Supabase client");
        const { data: existingCustomer } = await supabase.from('blaze_customers').select('id, blaze_id').eq('user_id', userId).eq('server_id', serverId).is('deleted_at', null).maybeSingle();
        
        let blazeResult: any;
        if (existingCustomer?.blaze_id) {
          try { blazeResult = await blazeRequest(`/api/customers/${existingCustomer.blaze_id}/renew`, "POST", { package_id: packageId || 0 }); }
          catch { blazeResult = await blazeRequest(`/api/customers/${existingCustomer.blaze_id}`, "PUT", { is_trial: true }); }
        } else {
          blazeResult = await blazeRequest("/api/customers", "POST", { username, password, server_id: serverId, package_id: packageId || 0, connections: 1, is_trial: true, notes: "Trial 4h - IPTV Link" });
        }
        
        const blazeId = blazeResult?.id || blazeResult?.data?.id || existingCustomer?.blaze_id;
        await supabase.rpc('upsert_customer_by_server', { p_user_id: userId, p_server_id: serverId, p_package_id: String(packageId || 0), p_plan_duration_days: 0, p_price: 0, p_is_trial: true, p_username: username, p_password: password, p_source: 'trial', p_blaze_id: blazeId ? String(blazeId) : null });
        result = { ...blazeResult, action: existingCustomer?.blaze_id ? 'updated' : 'created' };
        break;
      }

      case "auth_sessions_count": {
        const supabase = getSupabaseServiceClient();
        if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
        const { count, error } = await supabase.from("blaze_auth_cache").select("*", { count: "exact", head: true });
        result = { count: error ? 0 : (count ?? 0), active_sessions: count ?? 0 };
        break;
      }

      case "prune_sessions": {
        const supabase = getSupabaseServiceClient();
        if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
        // Keep only the singleton, delete any stale entries if they exist
        const { data: deleted, error } = await supabase.from("blaze_auth_cache").delete().neq("id", "singleton").select("id");
        result = { pruned: deleted?.length ?? 0, error: error?.message ?? null };
        break;
      }

      case "force_token_refresh":
      case "cron_renew_token": {
        // Verificar cron secret apenas para cron_renew_token (protege contra abusos)
        if (action === "cron_renew_token") {
          const expectedSecret = Deno.env.get("SIGMA_BLAZE_CRON_SECRET");
          const providedSecret = (params as any)?.secret;

          if (!expectedSecret || providedSecret !== expectedSecret) {
            console.warn("[cron_renew_token] Invalid or missing secret");
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        }

        const supabase = getSupabaseServiceClient();
        if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");

        // Libera lock
        try {
          await supabase
            .from("blaze_auth_cache")
            .update({ refresh_lock_until: null })
            .eq("id", "singleton");
        } catch {
          // ignore
        }

        console.log(`[${action}] Starting token refresh...`);

        // Força login
        const session = await getSigmaSession({ forceLogin: true, tenantId: currentRequestTenantId });

        // Atualiza credits/username
        const meData = await ensureMeData({ token: session.accessToken, supabase });

        // Buscar dados atualizados do DB
        const { data: freshCache } = await supabase
          .from("blaze_auth_cache")
          .select("expires_hint, last_refreshed_at, credits, username")
          .eq("id", "singleton")
          .maybeSingle();

        console.log(`[${action}] Token renewed at ${new Date().toISOString()}, expires: ${freshCache?.expires_hint}`);

        result = { 
          ok: true, 
          renewed_at: new Date().toISOString(),
          expires_at: freshCache?.expires_hint,
          credits: freshCache?.credits ?? meData?.credits,
          username: freshCache?.username ?? meData?.username,
        };
        break;
      }

      case "test_panel_connection": {
        // Testa conexão com diagnóstico detalhado
        const { base_url, username, password } = params as { base_url: string; username: string; password: string };
        
        if (!base_url || !username || !password) {
          return new Response(
            JSON.stringify({ error: "Missing required parameters: base_url, username, password" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const normalizedUrl = normalizeBlazeBaseUrl(base_url);
        const diagnosticSteps: Array<{ step: string; status: string; detail: string; duration_ms?: number }> = [];
        
        // Step 1: Testar se Deno.createHttpClient suporta proxy
        const proxies = getProxyList();
        diagnosticSteps.push({ step: "proxy_config", status: proxies.length > 0 ? "OK" : "SKIP", detail: `${proxies.length} proxy(s) configurado(s)` });

        // Step 2: Testar acesso DIRETO (sem proxy) à URL
        const directUrl = `${normalizedUrl.replace(/\/+$/, "")}/`;
        const directStart = Date.now();
        try {
          const directResp = await fetchWithTimeout(directUrl, {
            method: "GET",
            headers: getBlazeHeaders(directUrl),
          }, 10000);
          const directBody = (await directResp.text()).slice(0, 500);
          const isCf = looksLikeCloudflareBlock(directBody);
          diagnosticSteps.push({
            step: "direct_access",
            status: isCf ? "CLOUDFLARE_BLOCK" : `HTTP_${directResp.status}`,
            detail: isCf ? "Cloudflare challenge detected" : `Status ${directResp.status}, body: ${directBody.slice(0, 200)}`,
            duration_ms: Date.now() - directStart,
          });
        } catch (e) {
          diagnosticSteps.push({
            step: "direct_access",
            status: "ERROR",
            detail: e instanceof Error ? e.message : String(e),
            duration_ms: Date.now() - directStart,
          });
        }

        // Step 3: Testar proxy se configurado
        if (proxies.length > 0) {
          for (const proxyUrl of proxies) {
            const proxyStart = Date.now();
            try {
              const client = Deno.createHttpClient({ proxy: { url: proxyUrl } });
              diagnosticSteps.push({ step: "proxy_create_client", status: "OK", detail: `HttpClient created for proxy` });
              
              // Testar GET simples via proxy
              const proxyResp = await fetchWithTimeout(directUrl, {
                method: "GET",
                headers: getBlazeHeaders(directUrl),
                client,
              }, 15000);
              const proxyBody = (await proxyResp.text()).slice(0, 500);
              const isCf = looksLikeCloudflareBlock(proxyBody);
              diagnosticSteps.push({
                step: "proxy_get",
                status: isCf ? "CLOUDFLARE_BLOCK" : `HTTP_${proxyResp.status}`,
                detail: isCf ? "CF block via proxy" : `Status ${proxyResp.status}, body: ${proxyBody.slice(0, 200)}`,
                duration_ms: Date.now() - proxyStart,
              });
              
              // Se GET passou, testar LOGIN via proxy
              if (!isCf && proxyResp.status !== 403) {
                const loginUrls = [
                  joinBlazeUrl(normalizedUrl, "/api/auth/login"),
                  joinBlazeUrl(normalizedUrl, "/auth/login"),
                ];
                for (const loginUrl of loginUrls) {
                  const loginStart = Date.now();
                  try {
                    const loginResp = await fetchWithTimeout(loginUrl, {
                      method: "POST",
                      headers: getBlazeHeaders(loginUrl),
                      body: JSON.stringify({ username, password }),
                      client,
                    }, 15000);
                    const loginBody = await loginResp.text();
                    let parsed: any = null;
                    try { parsed = JSON.parse(loginBody); } catch {}
                    
                    const token = parsed?.token || parsed?.access_token || parsed?.data?.token;
                    
                    diagnosticSteps.push({
                      step: `proxy_login_${loginUrl.includes('/api/') ? 'api' : 'direct'}`,
                      status: loginResp.ok ? "SUCCESS" : `HTTP_${loginResp.status}`,
                      detail: loginResp.ok 
                        ? `Login OK! Token: ${token ? 'yes' : 'no'}` 
                        : `Failed: ${loginBody.slice(0, 300)}`,
                      duration_ms: Date.now() - loginStart,
                    });
                    
                    if (loginResp.ok && token) {
                      result = {
                        success: true,
                        message: "Conexão bem-sucedida via proxy!",
                        base_url: normalizedUrl,
                        login_url: loginUrl,
                        has_token: true,
                        diagnostics: diagnosticSteps,
                      };
                      break;
                    }
                  } catch (e) {
                    diagnosticSteps.push({
                      step: `proxy_login_${loginUrl.includes('/api/') ? 'api' : 'direct'}`,
                      status: "ERROR",
                      detail: e instanceof Error ? e.message : String(e),
                      duration_ms: Date.now() - loginStart,
                    });
                  }
                }
              }
            } catch (e) {
              diagnosticSteps.push({
                step: "proxy_create_client",
                status: "ERROR",
                detail: `Deno.createHttpClient failed: ${e instanceof Error ? e.message : String(e)}`,
                duration_ms: Date.now() - proxyStart,
              });
            }
          }
        }

        // Step 4: Tentar login DIRETO (sem proxy) como último recurso
        if (!result || !(result as any).success) {
          const loginUrls = [
            joinBlazeUrl(normalizedUrl, "/api/auth/login"),
            joinBlazeUrl(normalizedUrl, "/auth/login"),
          ];
          for (const loginUrl of loginUrls) {
            const loginStart = Date.now();
            try {
              const loginResp = await fetchWithTimeout(loginUrl, {
                method: "POST",
                headers: getBlazeHeaders(loginUrl),
                body: JSON.stringify({ username, password }),
              }, 10000);
              const loginBody = await loginResp.text();
              let parsed: any = null;
              try { parsed = JSON.parse(loginBody); } catch {}
              const token = parsed?.token || parsed?.access_token || parsed?.data?.token;
              const isCf = looksLikeCloudflareBlock(loginBody);
              
              diagnosticSteps.push({
                step: `direct_login_${loginUrl.includes('/api/') ? 'api' : 'direct'}`,
                status: loginResp.ok ? "SUCCESS" : isCf ? "CLOUDFLARE_BLOCK" : `HTTP_${loginResp.status}`,
                detail: loginResp.ok 
                  ? `Login OK! Token: ${token ? 'yes' : 'no'}`
                  : isCf ? "Cloudflare block" : `${loginBody.slice(0, 300)}`,
                duration_ms: Date.now() - loginStart,
              });
              
              if (loginResp.ok && token) {
                result = {
                  success: true,
                  message: "Conexão bem-sucedida (direto, sem proxy)!",
                  base_url: normalizedUrl,
                  login_url: loginUrl,
                  has_token: true,
                  diagnostics: diagnosticSteps,
                };
                break;
              }
            } catch (e) {
              diagnosticSteps.push({
                step: `direct_login_${loginUrl.includes('/api/') ? 'api' : 'direct'}`,
                status: "ERROR",
                detail: e instanceof Error ? e.message : String(e),
                duration_ms: Date.now() - loginStart,
              });
            }
          }
        }
        
        if (!result || !(result as any).success) {
          result = {
            success: false,
            message: "Todas as tentativas falharam",
            base_url: normalizedUrl,
            diagnostics: diagnosticSteps,
          };
        }
        break;
      }

      case "cleanup_maxplayer": {
        // ==================== CLEANUP MAXPLAYER ====================
         // Remove clientes MaxPlayer cujo cliente Blaze IPTV (mesmo username) está expirado
         // REGRA: Blaze IPTV é a fonte da verdade (billing oficial)
         //        MaxPlayer é satélite - não pode existir sem Blaze ativo
        const {
          dry_run = true,
          batch_size = 100,
          trigger_source = "manual",
        } = params as { dry_run?: boolean; batch_size?: number; trigger_source?: string };

        const supabase = getSupabaseServiceClient();
        if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");

        const MAXPLAYER_SERVER_ID = "RYAWRk1jlx";
         const BLAZE_IPTV_SERVER_ID = "BV4D3rLaqZ"; // Blaze IPTV - fonte da verdade
        const startTime = Date.now();
        
        // Criar registro da execução
        const { data: runData } = await supabase
          .from("maxplayer_cleanup_runs")
          .insert({ dry_run, trigger_source, status: "running" })
          .select("id")
          .single();
        
        const runId = runData?.id || "no-run-id";
        console.log(`[cleanup_maxplayer] Starting run ${runId} (dry_run: ${dry_run})`);

        // Helper: buscar todos clientes de um servidor
        const getAllCustomersCleanup = async (serverId: string) => {
          const allCustomers: any[] = [];
          let page = 1;
          const perPage = 100;
          let hasMore = true;
          
           // Buscar até 200 páginas (20.000 clientes por servidor)
           while (hasMore && page <= 200) {
            const listResult = await blazeRequest(`/api/customers?page=${page}&perPage=${perPage}&server_id=${serverId}`, "GET") as any;
            const customers = listResult?.data || [];
            allCustomers.push(...customers.filter((c: any) => c.server_id === serverId));
             const lastPage = listResult?.meta?.lastPage || listResult?.meta?.last_page || 1;
            hasMore = page < lastPage && customers.length === perPage;
            page++;
             // Rate limiting: 50ms entre requests
             await new Promise(r => setTimeout(r, 50));
          }
           console.log(`[cleanup_maxplayer] Fetched ${allCustomers.length} customers from server ${serverId} (${page - 1} pages)`);
          return allCustomers;
        };

        // Helper: verificar se expirado
        const isExpiredCleanup = (customer: any) => {
          const status = (customer.status || "").toUpperCase();
          if (["EXPIRED", "EXPIRADO", "INACTIVE", "INATIVO"].includes(status)) return true;
          if (customer.expires_at && new Date(customer.expires_at) < new Date()) return true;
          return false;
        };

        // Helper: verificar se deve pular
        const shouldSkipCleanup = async (customer: any) => {
          const now = new Date();
          const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          
          // Verificar atualização recente
          if (customer.updated_at && new Date(customer.updated_at) > oneDayAgo) {
            return { skip: true, reason: "updated_last_24h" };
          }
          
          // Verificar trial ativo no perfil
          const { data: profile } = await supabase
            .from("profiles")
            .select("account_status, trial_expires_at")
            .ilike("blaze_username", customer.username)
            .maybeSingle();
          
          if (profile?.account_status === "trial") {
            const trialExpires = profile.trial_expires_at ? new Date(profile.trial_expires_at) : null;
            if (!trialExpires || trialExpires > now) {
              return { skip: true, reason: "active_trial" };
            }
          }
          
          // Verificar pagamento recente
          const { data: recentPayments } = await supabase
            .from("payments")
            .select("id")
            .eq("status", "approved")
            .gte("updated_at", oneDayAgo.toISOString())
            .limit(1);
          
          if (recentPayments && recentPayments.length > 0) {
            return { skip: true, reason: "recent_payment_24h" };
          }
          
          return { skip: false, reason: "" };
        };

        // 1. Buscar todos os clientes MaxPlayer
        const allCustomersCleanup = await getAllCustomersCleanup(MAXPLAYER_SERVER_ID);
        console.log(`[cleanup_maxplayer] Found ${allCustomersCleanup.length} MaxPlayer customers`);
         // Helper: verificar se cliente Blaze IPTV está expirado
         const isBlazeExpired = (blazeClient: any) => {
           if (!blazeClient) return false;
           const status = (blazeClient.status || "").toUpperCase();
           if (["EXPIRED", "EXPIRADO", "INACTIVE", "INATIVO"].includes(status)) return true;
           if (blazeClient.expires_at && new Date(blazeClient.expires_at) < new Date()) return true;
           return false;
         };
 
         // Helper: verificar se deve pular (com contexto do cliente Blaze)
         const shouldSkipWithBlaze = async (maxplayerCustomer: any, blazeClient: any) => {
           const now = new Date();
           const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
           
            // NOTA: blazeClient pode ser null (órfão) - isso NÃO é motivo para pular
            // Órfãos (MaxPlayer sem Blaze correspondente) devem ser deletados
 
           // Verificar atualização recente no MaxPlayer
           if (maxplayerCustomer.updated_at && new Date(maxplayerCustomer.updated_at) > oneDayAgo) {
             return { skip: true, reason: "updated_last_24h" };
           }
           
            // Verificar se o cliente Blaze foi atualizado recentemente (só se existir)
            if (blazeClient?.updated_at && new Date(blazeClient.updated_at) > oneDayAgo) {
             return { skip: true, reason: "blaze_updated_last_24h" };
           }
 
           // Verificar trial ativo no perfil
           const { data: profile } = await supabase
             .from("profiles")
             .select("id, account_status, trial_expires_at")
             .ilike("blaze_username", maxplayerCustomer.username)
             .maybeSingle();
           
           if (profile?.account_status === "trial") {
             const trialExpires = profile.trial_expires_at ? new Date(profile.trial_expires_at) : null;
             if (!trialExpires || trialExpires > now) {
               return { skip: true, reason: "active_trial" };
             }
           }
 
           // Verificações de pagamento se encontrou o usuário
           if (profile?.id) {
             // Verificar pagamento pendente
             const { data: pendingPayments } = await supabase
               .from("payments")
               .select("id")
               .eq("user_id", profile.id)
               .eq("status", "pending")
               .limit(1);
 
             if (pendingPayments && pendingPayments.length > 0) {
               return { skip: true, reason: "pending_payment" };
             }
 
             // Verificar pagamento aprovado recente
             const { data: recentPayments } = await supabase
               .from("payments")
               .select("id")
               .eq("user_id", profile.id)
               .eq("status", "approved")
               .gte("updated_at", oneDayAgo.toISOString())
               .limit(1);
 
             if (recentPayments && recentPayments.length > 0) {
               return { skip: true, reason: "recent_payment_24h" };
             }
 
             // Verificar renovação agendada
             const { data: scheduledRenew } = await supabase
               .from("sigma_activation_retry_queue")
               .select("id")
               .eq("user_id", profile.id)
               .eq("status", "pending")
               .limit(1);
 
             if (scheduledRenew && scheduledRenew.length > 0) {
               return { skip: true, reason: "scheduled_renewal" };
             }
           }
           
           return { skip: false, reason: "" };
         };
 
         // 1b. Buscar todos os clientes Blaze IPTV (fonte da verdade)
         const blazeIptvCustomers = await getAllCustomersCleanup(BLAZE_IPTV_SERVER_ID);
         console.log(`[cleanup_maxplayer] Found ${blazeIptvCustomers.length} Blaze IPTV customers`);
 
         // 2. Criar índice por username para lookup O(1)
         const blazeByUsername = new Map<string, any>();
         for (const blazeClient of blazeIptvCustomers) {
           const username = (blazeClient.username || "").toLowerCase().trim();
           if (username) {
             const existing = blazeByUsername.get(username);
             if (!existing || (blazeClient.updated_at && existing.updated_at && new Date(blazeClient.updated_at) > new Date(existing.updated_at))) {
               blazeByUsername.set(username, blazeClient);
             }
           }
         }
         console.log(`[cleanup_maxplayer] Indexed ${blazeByUsername.size} unique Blaze IPTV usernames`);
 
         // 3. Identificar MaxPlayer cujo Blaze está expirado
         const eligibleForCleanup: Array<{ maxplayer: any; blaze: any }> = [];
         for (const maxplayerClient of allCustomersCleanup) {
           const username = (maxplayerClient.username || "").toLowerCase().trim();
           const blazeClient = blazeByUsername.get(username);
           
            // Considera para cleanup se:
            // 1. Existe no Blaze E o Blaze está expirado
            // 2. NÃO existe no Blaze (órfão - MaxPlayer sem correspondente)
            if (!blazeClient) {
              // Órfão: MaxPlayer sem cliente Blaze IPTV correspondente
              eligibleForCleanup.push({ maxplayer: maxplayerClient, blaze: null });
            } else if (isBlazeExpired(blazeClient)) {
              // Blaze expirado
              eligibleForCleanup.push({ maxplayer: maxplayerClient, blaze: blazeClient });
           }
         }
          const orphanCount = eligibleForCleanup.filter(e => !e.blaze).length;
          const expiredBlazeCount = eligibleForCleanup.filter(e => e.blaze).length;
          console.log(`[cleanup_maxplayer] Found ${eligibleForCleanup.length} eligible: ${orphanCount} orphans (no Blaze), ${expiredBlazeCount} with expired Blaze`);

         // 4. Processar em batch
         const toProcess = eligibleForCleanup.slice(0, batch_size);
        const cleanupResults: any[] = [];
        const skipReasons: Record<string, number> = {};
        let totalDeleted = 0;
        let totalSkipped = 0;
        let totalErrors = 0;

         for (const { maxplayer: customer, blaze: blazeClient } of toProcess) {
           const { skip, reason } = await shouldSkipWithBlaze(customer, blazeClient);
          
          if (skip) {
             cleanupResults.push({ 
               id: customer.id, 
               username: customer.username, 
               blaze_id: blazeClient?.id,
               blaze_status: blazeClient?.status,
               blaze_expires_at: blazeClient?.expires_at,
               action: "skipped", 
               reason 
             });
            totalSkipped++;
            skipReasons[reason] = (skipReasons[reason] || 0) + 1;
            
            await supabase.from("maxplayer_cleanup_logs").insert({
              client_id: customer.id,
              blaze_id: customer.id,
              username: customer.username,
              plan: "maxplayer",
              server_id: customer.server_id,
              expiration_date: customer.expires_at,
              reason,
              dry_run,
              success: true,
               metadata: { 
                 run_id: runId, 
                 original_status: customer.status,
                 blaze_client_id: blazeClient?.id,
                 blaze_status: blazeClient?.status,
                 blaze_expires_at: blazeClient?.expires_at,
               },
            });
            continue;
          }

          // Tentar excluir
          try {
            if (!dry_run) {
              await blazeRequest(`/api/customers/${customer.id}`, "DELETE");
              await supabase
                .from("blaze_customers")
                .update({ deleted_at: new Date().toISOString(), status: "DELETED" })
                .eq("blaze_id", customer.id);
            }
            
             cleanupResults.push({ 
               id: customer.id, 
               username: customer.username, 
               blaze_id: blazeClient?.id,
               blaze_status: blazeClient?.status,
               blaze_expires_at: blazeClient?.expires_at,
               action: "deleted", 
                reason: blazeClient ? "blaze_expired" : "orphan_no_blaze" 
             });
            totalDeleted++;
            
            await supabase.from("maxplayer_cleanup_logs").insert({
              client_id: customer.id,
              blaze_id: customer.id,
              username: customer.username,
              plan: "maxplayer",
              server_id: customer.server_id,
              expiration_date: customer.expires_at,
                reason: blazeClient ? "blaze_expired" : "orphan_no_blaze",
              dry_run,
              success: true,
               metadata: { 
                 run_id: runId, 
                 original_status: customer.status,
                 blaze_client_id: blazeClient?.id,
                 blaze_status: blazeClient?.status,
                 blaze_expires_at: blazeClient?.expires_at,
               },
            });
          } catch (e) {
            const errMsg = e instanceof Error ? e.message : String(e);
             cleanupResults.push({ 
               id: customer.id, 
               username: customer.username, 
               blaze_id: blazeClient?.id,
               action: "error", 
               reason: errMsg 
             });
            totalErrors++;
            
            await supabase.from("maxplayer_cleanup_logs").insert({
              client_id: customer.id,
              blaze_id: customer.id,
              username: customer.username,
              plan: "maxplayer",
              server_id: customer.server_id,
              expiration_date: customer.expires_at,
                reason: blazeClient ? "blaze_expired" : "orphan_no_blaze",
              dry_run,
              success: false,
              error_message: errMsg,
               metadata: { 
                 run_id: runId, 
                 original_status: customer.status,
                 blaze_client_id: blazeClient?.id,
                 blaze_status: blazeClient?.status,
               },
            });
          }
          
          await new Promise(r => setTimeout(r, 150));
        }

         // 5. Atualizar registro da execução
        const durationMs = Date.now() - startTime;
        await supabase
          .from("maxplayer_cleanup_runs")
          .update({
            completed_at: new Date().toISOString(),
            status: "completed",
            total_scanned: allCustomersCleanup.length,
             total_eligible: eligibleForCleanup.length,
            total_deleted: totalDeleted,
            total_skipped: totalSkipped,
            total_errors: totalErrors,
            skip_reasons: skipReasons,
            error_summary: cleanupResults.filter(r => r.action === "error").slice(0, 10),
          })
          .eq("id", runId);

        console.log(`[cleanup_maxplayer] Completed in ${durationMs}ms: deleted=${totalDeleted}, skipped=${totalSkipped}, errors=${totalErrors}`);

        result = {
          success: true,
          run_id: runId,
          dry_run,
          duration_ms: durationMs,
          summary: {
            total_maxplayer_customers: allCustomersCleanup.length,
             total_blaze_iptv_customers: blazeIptvCustomers.length,
              total_eligible: eligibleForCleanup.length,
              total_orphans: eligibleForCleanup.filter(e => !e.blaze).length,
              total_with_expired_blaze: eligibleForCleanup.filter(e => e.blaze).length,
            batch_processed: toProcess.length,
            deleted: totalDeleted,
            skipped: totalSkipped,
            errors: totalErrors,
          },
          skip_reasons: skipReasons,
          results: cleanupResults.slice(0, 50),
           has_more: eligibleForCleanup.length > batch_size,
        };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Sigma Blaze error:", message);
    const parts = String(message).split(":");
    const maybeStatus = parts.length >= 2 ? Number(parts[1]) : NaN;
    const status = Number.isFinite(maybeStatus) && maybeStatus >= 400 && maybeStatus <= 599 ? maybeStatus : 500;
    return new Response(JSON.stringify({ error: message }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
