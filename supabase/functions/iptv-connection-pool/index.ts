import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * Connection Pool Manager - Application-level PostgreSQL connection pooling
 * Provides transaction pooling mode for maximum concurrency with circuit breaker protection
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PoolConfig {
  maxConnections: number;
  minConnections: number;
  acquireTimeout: number;
  idleTimeout: number;
  maxLifetime: number;
}

interface ConnectionStats {
  total: number;
  active: number;
  idle: number;
  waiting: number;
  errors: number;
  acquiredCount: number;
  releasedCount: number;
  avgAcquireTime: number;
}

interface CircuitBreakerState {
  isOpen: boolean;
  failures: number;
  lastFailure: number;
  lastSuccess: number;
}

// Default pool configuration
const DEFAULT_CONFIG: PoolConfig = {
  maxConnections: 200,
  minConnections: 10,
  acquireTimeout: 10000, // 10 seconds
  idleTimeout: 30000, // 30 seconds
  maxLifetime: 300000, // 5 minutes
};

// Circuit breaker configuration
const CIRCUIT_BREAKER = {
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
  halfOpenRequests: 3,
};

// In-memory state (per isolate - will reset on cold start)
let poolStats: ConnectionStats = {
  total: 0,
  active: 0,
  idle: 0,
  waiting: 0,
  errors: 0,
  acquiredCount: 0,
  releasedCount: 0,
  avgAcquireTime: 0,
};

let circuitBreaker: CircuitBreakerState = {
  isOpen: false,
  failures: 0,
  lastFailure: 0,
  lastSuccess: 0,
};

let acquireTimes: number[] = [];

// Simulate connection acquisition (in real implementation, this would manage actual PG connections)
async function acquireConnection(): Promise<{ connectionId: string; acquireTime: number }> {
  const startTime = Date.now();
  
  // Check circuit breaker
  if (circuitBreaker.isOpen) {
    const timeSinceLastFailure = Date.now() - circuitBreaker.lastFailure;
    
    // Half-open: allow some requests through
    if (timeSinceLastFailure > CIRCUIT_BREAKER.resetTimeout) {
      console.log('Circuit breaker entering half-open state');
    } else {
      throw new Error('Circuit breaker is open - connection pool unavailable');
    }
  }
  
  // Check if we have capacity
  if (poolStats.active >= DEFAULT_CONFIG.maxConnections) {
    poolStats.waiting++;
    
    // Wait for connection with timeout
    const waitStart = Date.now();
    while (poolStats.active >= DEFAULT_CONFIG.maxConnections) {
      if (Date.now() - waitStart > DEFAULT_CONFIG.acquireTimeout) {
        poolStats.waiting--;
        throw new Error('Connection acquire timeout');
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    poolStats.waiting--;
  }
  
  // Simulate connection acquisition
  await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
  
  const acquireTime = Date.now() - startTime;
  const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Update stats
  poolStats.active++;
  poolStats.total = Math.max(poolStats.total, poolStats.active);
  poolStats.acquiredCount++;
  
  // Track acquire times for averaging
  acquireTimes.push(acquireTime);
  if (acquireTimes.length > 100) acquireTimes.shift();
  poolStats.avgAcquireTime = acquireTimes.reduce((a, b) => a + b, 0) / acquireTimes.length;
  
  // Record success
  circuitBreaker.lastSuccess = Date.now();
  circuitBreaker.failures = 0;
  if (circuitBreaker.isOpen) {
    circuitBreaker.isOpen = false;
    console.log('Circuit breaker closed after successful connection');
  }
  
  return { connectionId, acquireTime };
}

// Release connection back to pool
function releaseConnection(connectionId: string): void {
  poolStats.active = Math.max(0, poolStats.active - 1);
  poolStats.idle++;
  poolStats.releasedCount++;
  
  // Simulate cleanup for idle connections
  setTimeout(() => {
    if (poolStats.idle > DEFAULT_CONFIG.minConnections) {
      poolStats.idle--;
    }
  }, DEFAULT_CONFIG.idleTimeout);
}

// Record connection failure
function recordFailure(error: string): void {
  poolStats.errors++;
  circuitBreaker.failures++;
  circuitBreaker.lastFailure = Date.now();
  
  if (circuitBreaker.failures >= CIRCUIT_BREAKER.failureThreshold) {
    circuitBreaker.isOpen = true;
    console.log('Circuit breaker opened due to failures:', circuitBreaker.failures);
  }
}

// Execute query with pooled connection
async function executeWithPool<T>(
  queryFn: (connectionId: string) => Promise<T>
): Promise<{ result: T; connectionId: string; executionTime: number }> {
  const { connectionId, acquireTime } = await acquireConnection();
  const startTime = Date.now();
  
  try {
    const result = await queryFn(connectionId);
    const executionTime = Date.now() - startTime;
    
    return { result, connectionId, executionTime };
  } catch (error) {
    recordFailure(error instanceof Error ? error.message : 'Unknown error');
    throw error;
  } finally {
    releaseConnection(connectionId);
  }
}

// Health check
function getPoolHealth(): {
  status: 'healthy' | 'degraded' | 'unhealthy';
  stats: ConnectionStats;
  circuitBreaker: CircuitBreakerState;
  config: PoolConfig;
} {
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  
  if (circuitBreaker.isOpen) {
    status = 'unhealthy';
  } else if (poolStats.active > DEFAULT_CONFIG.maxConnections * 0.8) {
    status = 'degraded';
  } else if (poolStats.errors > 10) {
    status = 'degraded';
  }
  
  return {
    status,
    stats: { ...poolStats },
    circuitBreaker: { ...circuitBreaker },
    config: DEFAULT_CONFIG,
  };
}

// Reset pool (for maintenance)
function resetPool(): void {
  poolStats = {
    total: 0,
    active: 0,
    idle: 0,
    waiting: 0,
    errors: 0,
    acquiredCount: 0,
    releasedCount: 0,
    avgAcquireTime: 0,
  };
  
  circuitBreaker = {
    isOpen: false,
    failures: 0,
    lastFailure: 0,
    lastSuccess: 0,
  };
  
  acquireTimes = [];
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.split('/').pop();

  try {
    switch (path) {
      case 'health': {
        const health = getPoolHealth();
        return new Response(JSON.stringify({
          success: true,
          ...health,
          timestamp: new Date().toISOString(),
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'stats': {
        return new Response(JSON.stringify({
          success: true,
          stats: poolStats,
          circuitBreaker,
          timestamp: new Date().toISOString(),
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'acquire': {
        const connection = await acquireConnection();
        return new Response(JSON.stringify({
          success: true,
          ...connection,
          stats: poolStats,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'release': {
        const body = await req.json() as { connectionId: string };
        releaseConnection(body.connectionId);
        return new Response(JSON.stringify({
          success: true,
          released: body.connectionId,
          stats: poolStats,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'execute': {
        // Execute a simulated query with connection pooling
        const body = await req.json() as { query?: string; simulate?: boolean };
        
        const result = await executeWithPool(async (connId) => {
          // Simulate query execution
          await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
          return {
            rows: [],
            rowCount: 0,
            connectionId: connId,
          };
        });
        
        return new Response(JSON.stringify({
          success: true,
          ...result,
          stats: poolStats,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'reset': {
        // Verify authorization
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        resetPool();
        return new Response(JSON.stringify({
          success: true,
          message: 'Pool reset successfully',
          stats: poolStats,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'config': {
        return new Response(JSON.stringify({
          success: true,
          config: DEFAULT_CONFIG,
          circuitBreakerConfig: CIRCUIT_BREAKER,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({
          error: 'Unknown action',
          availableActions: ['health', 'stats', 'acquire', 'release', 'execute', 'reset', 'config'],
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    console.error('Connection pool error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stats: poolStats,
      circuitBreaker,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
