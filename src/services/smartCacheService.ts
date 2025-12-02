/**
 * Smart Cache Service
 * 
 * Gerencia regras de cache, estatísticas e invalidações
 */

import { supabase } from '@/integrations/supabase/client';

export interface CacheRule {
  id: string;
  name: string;
  description: string | null;
  match_pattern: string;
  match_type: 'exact' | 'prefix' | 'regex';
  ttl: number;
  stale_while_revalidate: number | null;
  stale_if_error: number | null;
  priority: number;
  enabled: boolean;
  scope: any;
  headers: any;
  created_at: string;
  updated_at: string;
  last_applied_at: string | null;
}

export interface CacheStats {
  id: string;
  rule_id: string | null;
  hits: number;
  misses: number;
  stale_hits: number;
  errors: number;
  avg_response_time_ms: number | null;
  p95_response_time_ms: number | null;
  bandwidth_saved_bytes: number | null;
  window_start: string;
  window_end: string;
  collected_at: string;
}

export interface CacheInvalidation {
  id: string;
  pattern: string;
  invalidation_type: 'url' | 'prefix' | 'tag';
  scope: string | null;
  status: 'pending' | 'completed' | 'failed';
  initiated_by: string | null;
  initiated_at: string;
  completed_at: string | null;
  error_message: string | null;
  keys_invalidated: number | null;
  metadata: any;
}

export interface CreateCacheRuleParams {
  name: string;
  description?: string;
  match_pattern: string;
  match_type: 'exact' | 'prefix' | 'regex';
  ttl: number;
  stale_while_revalidate?: number;
  stale_if_error?: number;
  priority?: number;
  enabled?: boolean;
  scope?: any;
  headers?: any;
}

export interface UpdateCacheRuleParams extends Partial<CreateCacheRuleParams> {
  id: string;
}

export interface InvalidateCacheParams {
  pattern: string;
  type: 'url' | 'prefix' | 'tag';
  scope?: string;
  metadata?: any;
}

export interface CacheSummary {
  total_rules: number;
  enabled_rules: number;
  total_hits: number;
  total_misses: number;
  hit_rate: number;
  avg_response_time_ms: number;
  total_bandwidth_saved_gb: number;
}

class SmartCacheService {
  /**
   * Lista todas as regras de cache
   */
  async listRules(params?: {
    enabled?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ data: CacheRule[] | null; error: any }> {
    let query = supabase
      .from('cache_rules')
      .select('*')
      .order('priority', { ascending: false });

    if (params?.enabled !== undefined) {
      query = query.eq('enabled', params.enabled);
    }

    if (params?.limit) {
      query = query.limit(params.limit);
    }

    if (params?.offset) {
      query = query.range(params.offset, params.offset + (params.limit || 10) - 1);
    }

    const result = await query;
    return { data: result.data as CacheRule[] | null, error: result.error };
  }

  /**
   * Busca uma regra específica
   */
  async getRule(id: string): Promise<{ data: CacheRule | null; error: any }> {
    return await supabase
      .from('cache_rules')
      .select('*')
      .eq('id', id)
      .single();
  }

  /**
   * Cria nova regra de cache
   */
  async createRule(params: CreateCacheRuleParams): Promise<{ data: CacheRule | null; error: any }> {
    return await supabase
      .from('cache_rules')
      .insert({
        name: params.name,
        description: params.description || null,
        match_pattern: params.match_pattern,
        match_type: params.match_type,
        ttl: params.ttl,
        stale_while_revalidate: params.stale_while_revalidate || null,
        stale_if_error: params.stale_if_error || null,
        priority: params.priority || 0,
        enabled: params.enabled !== undefined ? params.enabled : true,
        scope: params.scope || null,
        headers: params.headers || null,
      })
      .select()
      .single();
  }

  /**
   * Atualiza regra existente
   */
  async updateRule(params: UpdateCacheRuleParams): Promise<{ data: CacheRule | null; error: any }> {
    const { id, ...updates } = params;
    
    return await supabase
      .from('cache_rules')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
  }

  /**
   * Deleta regra de cache
   */
  async deleteRule(id: string): Promise<{ error: any }> {
    return await supabase
      .from('cache_rules')
      .delete()
      .eq('id', id);
  }

  /**
   * Toggle enabled/disabled de uma regra
   */
  async toggleRule(id: string, enabled: boolean): Promise<{ data: CacheRule | null; error: any }> {
    return await supabase
      .from('cache_rules')
      .update({ enabled })
      .eq('id', id)
      .select()
      .single();
  }

  /**
   * Busca estatísticas agregadas de cache
   */
  async getStats(params?: {
    ruleId?: string;
    hoursAgo?: number;
  }): Promise<{ data: CacheStats[] | null; error: any }> {
    let query = supabase
      .from('cache_stats')
      .select('*')
      .order('collected_at', { ascending: false });

    if (params?.ruleId) {
      query = query.eq('rule_id', params.ruleId);
    }

    if (params?.hoursAgo) {
      const since = new Date(Date.now() - params.hoursAgo * 60 * 60 * 1000).toISOString();
      query = query.gte('collected_at', since);
    }

    return await query;
  }

  /**
   * Busca sumário geral do cache
   */
  async getSummary(): Promise<{ data: CacheSummary | null; error: any }> {
    try {
      const { data, error } = await supabase.rpc('get_cache_coverage_summary');
      
      if (error) throw error;

      const summary = data as any;

      return {
        data: {
          total_rules: summary?.total_rules || 0,
          enabled_rules: summary?.enabled_rules || 0,
          total_hits: summary?.total_hits || 0,
          total_misses: summary?.total_misses || 0,
          hit_rate: summary?.hit_rate || 0,
          avg_response_time_ms: 0, // Será calculado no backend
          total_bandwidth_saved_gb: 0, // Será calculado no backend
        },
        error: null,
      };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Invalida cache via Edge Function
   */
  async invalidateCache(params: InvalidateCacheParams): Promise<{ 
    data: { success: boolean; invalidation_id?: string; keys_invalidated?: number } | null; 
    error: any 
  }> {
    try {
      const { data, error } = await supabase.functions.invoke('cache-invalidate', {
        body: {
          pattern: params.pattern,
          type: params.type,
          scope: params.scope,
          metadata: params.metadata,
        },
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Lista histórico de invalidações
   */
  async listInvalidations(params?: {
    status?: 'pending' | 'completed' | 'failed';
    limit?: number;
  }): Promise<{ data: CacheInvalidation[] | null; error: any }> {
    let query = supabase
      .from('cache_invalidations')
      .select('*')
      .order('initiated_at', { ascending: false });

    if (params?.status) {
      query = query.eq('status', params.status);
    }

    if (params?.limit) {
      query = query.limit(params.limit);
    }

    const result = await query;
    return { data: result.data as CacheInvalidation[] | null, error: result.error };
  }

  /**
   * Busca detalhes de uma invalidação
   */
  async getInvalidation(id: string): Promise<{ data: CacheInvalidation | null; error: any }> {
    return await supabase
      .from('cache_invalidations')
      .select('*')
      .eq('id', id)
      .single();
  }
}

export const smartCacheService = new SmartCacheService();
