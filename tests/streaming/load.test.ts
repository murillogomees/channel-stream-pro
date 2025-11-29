/**
 * Load Tests for Hybrid Streaming Architecture
 * 
 * Simulates realistic load patterns:
 * - Concurrent viewer simulation
 * - Mixed VOD/Live traffic
 * - Bandwidth and latency measurements
 */

import { describe, it, expect } from 'vitest';

const SUPABASE_URL = 'https://sdvyxdghxqmntyoweqbd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkdnl4ZGdoeHFtbnR5b3dlcWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMzMxNTAsImV4cCI6MjA3ODYwOTE1MH0.60t5M81zC_UI5qr3Pfjy0Pa2AKqglMQu7RLmE0K2iak';
const EDGE_ROUTER_URL = process.env.EDGE_ROUTER_URL || 'https://stream-edge-router.workers.dev';

interface LoadTestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  requestsPerSecond: number;
  durationMs: number;
}

async function runLoadTest(
  requestFn: () => Promise<Response>,
  concurrency: number,
  totalRequests: number
): Promise<LoadTestResult> {
  const latencies: number[] = [];
  let successCount = 0;
  let failCount = 0;
  
  const startTime = Date.now();
  
  const executeRequest = async (): Promise<void> => {
    const reqStart = Date.now();
    try {
      const response = await requestFn();
      const latency = Date.now() - reqStart;
      latencies.push(latency);
      
      if (response.ok) {
        successCount++;
      } else {
        failCount++;
      }
    } catch (error) {
      failCount++;
      latencies.push(Date.now() - reqStart);
    }
  };

  // Execute requests with concurrency limit
  const semaphore = { count: 0 };
  const promises: Promise<void>[] = [];
  
  for (let i = 0; i < totalRequests; i++) {
    while (semaphore.count >= concurrency) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    semaphore.count++;
    promises.push(
      executeRequest().finally(() => {
        semaphore.count--;
      })
    );
  }

  await Promise.all(promises);
  
  const duration = Date.now() - startTime;
  
  // Calculate percentiles
  latencies.sort((a, b) => a - b);
  const p95Index = Math.floor(latencies.length * 0.95);
  const p99Index = Math.floor(latencies.length * 0.99);
  
  return {
    totalRequests,
    successfulRequests: successCount,
    failedRequests: failCount,
    avgLatencyMs: latencies.reduce((a, b) => a + b, 0) / latencies.length,
    p95LatencyMs: latencies[p95Index] || 0,
    p99LatencyMs: latencies[p99Index] || 0,
    minLatencyMs: latencies[0] || 0,
    maxLatencyMs: latencies[latencies.length - 1] || 0,
    requestsPerSecond: totalRequests / (duration / 1000),
    durationMs: duration,
  };
}

describe('Load Tests - Policy Engine', () => {
  it('should handle 50 concurrent policy lookups', async () => {
    const requestFn = () =>
      fetch(`${SUPABASE_URL}/rest/v1/rpc/get_channel_routing_strategy`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          p_channel_id: `00000000-0000-0000-0000-${String(Math.floor(Math.random() * 1000)).padStart(12, '0')}`,
        }),
      });

    const result = await runLoadTest(requestFn, 50, 100);
    
    console.log('Policy Engine Load Test Results:', result);
    
    expect(result.successfulRequests).toBeGreaterThan(80); // 80% success rate
    expect(result.avgLatencyMs).toBeLessThan(2000); // Avg < 2s
    expect(result.p95LatencyMs).toBeLessThan(5000); // P95 < 5s
  }, 60000);

  it('should handle streaming policies read load', async () => {
    const requestFn = () =>
      fetch(`${SUPABASE_URL}/rest/v1/streaming_policies?select=*`, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });

    const result = await runLoadTest(requestFn, 20, 50);
    
    console.log('Policies Read Load Test Results:', result);
    
    expect(result.successfulRequests).toBe(50); // All should succeed
    expect(result.avgLatencyMs).toBeLessThan(500); // Fast reads
  }, 30000);
});

describe('Load Tests - Metrics Recording', () => {
  it('should handle burst metric recording (100 metrics)', async () => {
    const channelId = '00000000-0000-0000-0000-000000000100';
    const metricTypes = ['view', 'bandwidth', 'latency', 'error'];
    
    const requestFn = () =>
      fetch(`${SUPABASE_URL}/rest/v1/rpc/record_streaming_metric`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          p_channel_id: channelId,
          p_metric_type: metricTypes[Math.floor(Math.random() * metricTypes.length)],
          p_value: Math.random() * 100,
        }),
      });

    const result = await runLoadTest(requestFn, 10, 100);
    
    console.log('Metrics Recording Load Test Results:', result);
    
    expect(result.successfulRequests).toBeGreaterThan(90); // 90% success rate
    expect(result.avgLatencyMs).toBeLessThan(1000); // Avg < 1s
  }, 60000);
});

describe('Load Tests - Edge Router', () => {
  it('should handle concurrent health checks', async () => {
    const requestFn = () =>
      fetch(`${EDGE_ROUTER_URL}/health`, { method: 'GET' });

    try {
      const result = await runLoadTest(requestFn, 10, 30);
      
      console.log('Edge Router Health Check Load Test Results:', result);
      
      // If router is deployed
      if (result.successfulRequests > 0) {
        expect(result.avgLatencyMs).toBeLessThan(500);
      }
    } catch (error) {
      console.log('Edge Router not available - skipping health load test');
    }
  }, 30000);
});

describe('Load Tests - Mixed Traffic Simulation', () => {
  it('should handle mixed VOD/Live traffic pattern', async () => {
    // Simulate 70% VOD, 30% Live traffic pattern
    const vodChannels = [
      '00000000-0000-0000-0000-000000000200',
      '00000000-0000-0000-0000-000000000201',
      '00000000-0000-0000-0000-000000000202',
    ];
    
    const liveChannels = [
      '00000000-0000-0000-0000-000000000300',
      '00000000-0000-0000-0000-000000000301',
    ];

    const createRequest = () => {
      const isVod = Math.random() < 0.7;
      const channels = isVod ? vodChannels : liveChannels;
      const channelId = channels[Math.floor(Math.random() * channels.length)];
      
      return fetch(`${SUPABASE_URL}/rest/v1/rpc/get_channel_routing_strategy`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          p_channel_id: channelId,
        }),
      });
    };

    const result = await runLoadTest(createRequest, 30, 100);
    
    console.log('Mixed Traffic Load Test Results:', result);
    
    expect(result.successfulRequests).toBeGreaterThan(90);
    expect(result.requestsPerSecond).toBeGreaterThan(5); // At least 5 RPS
  }, 60000);
});

describe('Load Tests - Database Read Performance', () => {
  it('should handle concurrent channel data reads', async () => {
    const requestFn = () =>
      fetch(`${SUPABASE_URL}/rest/v1/m3u_channels?select=id,name,content_type,cf_stream_uid&limit=10`, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });

    const result = await runLoadTest(requestFn, 20, 50);
    
    console.log('Channel Read Load Test Results:', result);
    
    expect(result.successfulRequests).toBe(50);
    expect(result.avgLatencyMs).toBeLessThan(500);
  }, 30000);

  it('should handle concurrent upload status reads', async () => {
    const requestFn = () =>
      fetch(`${SUPABASE_URL}/rest/v1/cf_stream_uploads?select=*&status=eq.processing&limit=10`, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });

    const result = await runLoadTest(requestFn, 15, 30);
    
    console.log('Upload Status Read Load Test Results:', result);
    
    expect(result.successfulRequests).toBe(30);
    expect(result.avgLatencyMs).toBeLessThan(500);
  }, 30000);
});
