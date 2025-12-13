import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Read Replica Router - Intelligent query routing for read/write separation
 * Routes reads to replica, writes to primary with automatic failover
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReplicaConfig {
  id: string;
  url: string;
  isHealthy: boolean;
  lastCheck: number;
  latencyMs: number;
  weight: number;
  region?: string;
}

interface RouterStats {
  totalReads: number;
  totalWrites: number;
  replicaReads: number;
  primaryReads: number;
  failovers: number;
  avgReadLatency: number;
  avgWriteLatency: number;
}

// Configuration
const PRIMARY_URL = Deno.env.get('SUPABASE_URL') || '';
const PRIMARY_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Replica URLs (configure via environment or defaults)
const REPLICA_URLS = (Deno.env.get('REPLICA_URLS') || '').split(',').filter(Boolean);

// In-memory state
let replicas: ReplicaConfig[] = [];
let stats: RouterStats = {
  totalReads: 0,
  totalWrites: 0,
  replicaReads: 0,
  primaryReads: 0,
  failovers: 0,
  avgReadLatency: 0,
  avgWriteLatency: 0,
};

let readLatencies: number[] = [];
let writeLatencies: number[] = [];

// Initialize replicas
function initializeReplicas(): void {
  replicas = REPLICA_URLS.map((url, index) => ({
    id: `replica-${index + 1}`,
    url: url.trim(),
    isHealthy: true,
    lastCheck: 0,
    latencyMs: 0,
    weight: 100,
  }));

  // Always add primary as fallback
  replicas.push({
    id: 'primary',
    url: PRIMARY_URL,
    isHealthy: true,
    lastCheck: Date.now(),
    latencyMs: 0,
    weight: 50, // Lower weight so replicas are preferred
  });

  console.log(`Initialized ${replicas.length} replicas (including primary fallback)`);
}

// Health check a replica
async function checkReplicaHealth(replica: ReplicaConfig): Promise<boolean> {
  const startTime = Date.now();
  
  try {
    const client = createClient(replica.url, PRIMARY_KEY);
    
    // Simple health check query
    const { error } = await client
      .from('profiles')
      .select('id')
      .limit(1)
      .single();
    
    const latency = Date.now() - startTime;
    
    replica.latencyMs = latency;
    replica.lastCheck = Date.now();
    replica.isHealthy = !error || error.code === 'PGRST116'; // No rows is OK
    
    return replica.isHealthy;
  } catch (error) {
    replica.isHealthy = false;
    replica.lastCheck = Date.now();
    console.error(`Replica ${replica.id} health check failed:`, error);
    return false;
  }
}

// Select best replica for read
function selectReplica(): ReplicaConfig | null {
  const healthyReplicas = replicas.filter(r => r.isHealthy && r.id !== 'primary');
  
  if (healthyReplicas.length === 0) {
    // Fallback to primary
    const primary = replicas.find(r => r.id === 'primary');
    if (primary?.isHealthy) {
      stats.failovers++;
      return primary;
    }
    return null;
  }
  
  // Weighted selection based on latency
  const totalWeight = healthyReplicas.reduce((sum, r) => {
    // Lower latency = higher effective weight
    const latencyFactor = Math.max(1, 1000 - r.latencyMs) / 1000;
    return sum + (r.weight * latencyFactor);
  }, 0);
  
  let random = Math.random() * totalWeight;
  
  for (const replica of healthyReplicas) {
    const latencyFactor = Math.max(1, 1000 - replica.latencyMs) / 1000;
    random -= replica.weight * latencyFactor;
    if (random <= 0) return replica;
  }
  
  return healthyReplicas[0];
}

// Get primary for writes
function getPrimary(): ReplicaConfig | null {
  const primary = replicas.find(r => r.id === 'primary');
  return primary?.isHealthy ? primary : null;
}

// Determine if query is a read or write
function isReadQuery(operation: string): boolean {
  const readOperations = ['select', 'get', 'list', 'count', 'head'];
  return readOperations.includes(operation.toLowerCase());
}

// Execute query through router
async function routeQuery(
  table: string,
  operation: string,
  params: Record<string, any>
): Promise<{ data: any; error: any; replica: string; latencyMs: number }> {
  const isRead = isReadQuery(operation);
  const startTime = Date.now();
  
  let targetReplica: ReplicaConfig | null;
  
  if (isRead) {
    targetReplica = selectReplica();
    stats.totalReads++;
    
    if (targetReplica?.id === 'primary') {
      stats.primaryReads++;
    } else {
      stats.replicaReads++;
    }
  } else {
    targetReplica = getPrimary();
    stats.totalWrites++;
  }
  
  if (!targetReplica) {
    return {
      data: null,
      error: { message: 'No healthy replicas available' },
      replica: 'none',
      latencyMs: Date.now() - startTime,
    };
  }
  
  try {
    const client = createClient(targetReplica.url, PRIMARY_KEY);
    let query = client.from(table);
    
    // Apply operation
    switch (operation.toLowerCase()) {
      case 'select':
        query = query.select(params.columns || '*');
        if (params.filters) {
          for (const [key, value] of Object.entries(params.filters)) {
            query = query.eq(key, value);
          }
        }
        if (params.limit) query = query.limit(params.limit);
        if (params.offset) query = query.range(params.offset, params.offset + (params.limit || 10) - 1);
        if (params.order) query = query.order(params.order.column, { ascending: params.order.ascending ?? true });
        break;
        
      case 'insert':
        query = query.insert(params.data);
        break;
        
      case 'update':
        query = query.update(params.data);
        if (params.filters) {
          for (const [key, value] of Object.entries(params.filters)) {
            query = query.eq(key, value);
          }
        }
        break;
        
      case 'delete':
        query = query.delete();
        if (params.filters) {
          for (const [key, value] of Object.entries(params.filters)) {
            query = query.eq(key, value);
          }
        }
        break;
        
      case 'count':
        const { count, error: countError } = await client
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        const latencyMs = Date.now() - startTime;
        updateLatencyStats(isRead, latencyMs);
        
        return {
          data: { count },
          error: countError,
          replica: targetReplica.id,
          latencyMs,
        };
    }
    
    const { data, error } = await query;
    const latencyMs = Date.now() - startTime;
    
    // Update latency stats
    updateLatencyStats(isRead, latencyMs);
    
    // If replica failed, mark as unhealthy and retry with primary
    if (error && targetReplica.id !== 'primary') {
      targetReplica.isHealthy = false;
      console.log(`Replica ${targetReplica.id} failed, retrying with primary`);
      return routeQuery(table, operation, params);
    }
    
    return {
      data,
      error,
      replica: targetReplica.id,
      latencyMs,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    
    if (targetReplica.id !== 'primary') {
      targetReplica.isHealthy = false;
      return routeQuery(table, operation, params);
    }
    
    return {
      data: null,
      error: { message: error instanceof Error ? error.message : 'Unknown error' },
      replica: targetReplica.id,
      latencyMs,
    };
  }
}

function updateLatencyStats(isRead: boolean, latencyMs: number): void {
  if (isRead) {
    readLatencies.push(latencyMs);
    if (readLatencies.length > 100) readLatencies.shift();
    stats.avgReadLatency = readLatencies.reduce((a, b) => a + b, 0) / readLatencies.length;
  } else {
    writeLatencies.push(latencyMs);
    if (writeLatencies.length > 100) writeLatencies.shift();
    stats.avgWriteLatency = writeLatencies.reduce((a, b) => a + b, 0) / writeLatencies.length;
  }
}

// Initialize on first request
let initialized = false;

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!initialized) {
    initializeReplicas();
    initialized = true;
  }

  const url = new URL(req.url);
  const path = url.pathname.split('/').pop();

  try {
    switch (path) {
      case 'health': {
        // Run health checks on all replicas
        const healthResults = await Promise.all(
          replicas.map(async (replica) => ({
            id: replica.id,
            url: replica.url.substring(0, 50) + '...',
            healthy: await checkReplicaHealth(replica),
            latencyMs: replica.latencyMs,
          }))
        );
        
        const healthyCount = healthResults.filter(r => r.healthy).length;
        
        return new Response(JSON.stringify({
          success: true,
          status: healthyCount > 0 ? 'healthy' : 'unhealthy',
          replicas: healthResults,
          stats,
          timestamp: new Date().toISOString(),
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'stats': {
        return new Response(JSON.stringify({
          success: true,
          stats,
          replicas: replicas.map(r => ({
            id: r.id,
            isHealthy: r.isHealthy,
            latencyMs: r.latencyMs,
            weight: r.weight,
          })),
          timestamp: new Date().toISOString(),
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'query': {
        const body = await req.json() as {
          table: string;
          operation: string;
          params?: Record<string, any>;
        };
        
        if (!body.table || !body.operation) {
          return new Response(JSON.stringify({
            error: 'Missing required fields: table, operation',
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        const result = await routeQuery(body.table, body.operation, body.params || {});
        
        return new Response(JSON.stringify({
          success: !result.error,
          ...result,
        }), {
          status: result.error ? 500 : 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'replicas': {
        if (req.method === 'GET') {
          return new Response(JSON.stringify({
            success: true,
            replicas: replicas.map(r => ({
              ...r,
              url: r.url.substring(0, 50) + '...',
            })),
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        if (req.method === 'POST') {
          const body = await req.json() as { url: string; weight?: number; region?: string };
          
          replicas.push({
            id: `replica-${replicas.length}`,
            url: body.url,
            isHealthy: true,
            lastCheck: 0,
            latencyMs: 0,
            weight: body.weight || 100,
            region: body.region,
          });
          
          return new Response(JSON.stringify({
            success: true,
            message: 'Replica added',
            replicaCount: replicas.length,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        break;
      }

      case 'reset': {
        stats = {
          totalReads: 0,
          totalWrites: 0,
          replicaReads: 0,
          primaryReads: 0,
          failovers: 0,
          avgReadLatency: 0,
          avgWriteLatency: 0,
        };
        readLatencies = [];
        writeLatencies = [];
        
        // Reset replica health
        replicas.forEach(r => {
          r.isHealthy = true;
          r.latencyMs = 0;
        });
        
        return new Response(JSON.stringify({
          success: true,
          message: 'Router stats and replica health reset',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({
          error: 'Unknown action',
          availableActions: ['health', 'stats', 'query', 'replicas', 'reset'],
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    console.error('Read replica router error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
