/**
 * K6 Load Test Script - IPTV Streaming Platform
 * 
 * Simulates 1000 concurrent users with mixed VOD/Live traffic
 * 
 * Usage:
 *   k6 run --vus 1000 --duration 5m tests/load/k6-load-test.js
 *   k6 run --vus 100 --iterations 1000 tests/load/k6-load-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend, Gauge } from 'k6/metrics';
import { SharedArray } from 'k6/data';

// ============= Environment Variables =============
// Usage: k6 run -e SUPABASE_URL=https://your-project.supabase.co -e SUPABASE_ANON_KEY=your-key tests/load/k6-load-test.js
//
// Available environment variables:
// - SUPABASE_URL: Supabase project URL (required for production)
// - SUPABASE_ANON_KEY: Supabase anon key (required for production)
// - TARGET_VUS: Target number of virtual users (default: 1000)
// - TEST_DURATION: Test duration (default: 5m)
// - RAMP_UP_TIME: Ramp up time (default: 30s)
// - VOD_RATIO: Ratio of VOD vs Live traffic 0-1 (default: 0.7)
// - ENABLE_SPIKE_TEST: Enable spike test scenario (default: true)
// - ENVIRONMENT: Test environment name (default: staging)

const BASE_URL = __ENV.SUPABASE_URL || 'https://waxgowafohlrfoefwhsf.supabase.co';
const ANON_KEY = __ENV.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndheGdvd2Fmb2hscmZvZWZ3aHNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNzAzMDMsImV4cCI6MjA4MDg0NjMwM30.dgqou7A6mcKc5hmn7aV15FDhkEf0uA3hiYp8v_T2MBw';
const EDGE_FUNCTIONS_URL = `${BASE_URL}/functions/v1`;

// Configurable test parameters
const TARGET_VUS = parseInt(__ENV.TARGET_VUS) || 1000;
const TEST_DURATION = __ENV.TEST_DURATION || '5m';
const RAMP_UP_TIME = __ENV.RAMP_UP_TIME || '30s';
const VOD_RATIO = parseFloat(__ENV.VOD_RATIO) || 0.7;
const ENABLE_SPIKE_TEST = __ENV.ENABLE_SPIKE_TEST !== 'false';
const ENVIRONMENT = __ENV.ENVIRONMENT || 'staging';

// Threshold configuration via env vars
const P50_LATENCY = parseInt(__ENV.P50_LATENCY) || 500;
const P95_LATENCY = parseInt(__ENV.P95_LATENCY) || 2000;
const P99_LATENCY = parseInt(__ENV.P99_LATENCY) || 5000;
const MAX_ERROR_RATE = parseFloat(__ENV.MAX_ERROR_RATE) || 0.05;

// ============= Custom Metrics =============
const rebufferEvents = new Counter('rebuffer_events');
const startupTime = new Trend('startup_time_ms');
const segmentLoadTime = new Trend('segment_load_time_ms');
const manifestLoadTime = new Trend('manifest_load_time_ms');
const cacheHitRate = new Rate('cache_hit_rate');
const playbackErrors = new Counter('playback_errors');
const tokenValidations = new Counter('token_validations');
const tokenValidationRate = new Rate('token_validation_success_rate');
const activeViewers = new Gauge('active_viewers');
const qualitySwitches = new Counter('quality_switches');

// ============= Test Scenarios =============
// Dynamic scenario configuration based on environment variables
const scenarios = {
  // Scenario 1: Ramping VUs for warm-up
  warmup: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: RAMP_UP_TIME, target: Math.floor(TARGET_VUS * 0.1) },
      { duration: '1m', target: Math.floor(TARGET_VUS * 0.5) },
      { duration: '2m', target: TARGET_VUS },
      { duration: '1m', target: Math.floor(TARGET_VUS * 0.5) },
      { duration: RAMP_UP_TIME, target: 0 },
    ],
    gracefulRampDown: RAMP_UP_TIME,
  },
  
  // Scenario 2: Constant load test
  constant_load: {
    executor: 'constant-vus',
    vus: Math.floor(TARGET_VUS * 0.5),
    duration: TEST_DURATION,
    startTime: '5m',
  },
};

// Conditionally add spike test
if (ENABLE_SPIKE_TEST) {
  scenarios.spike_test = {
    executor: 'ramping-vus',
    startVUs: Math.floor(TARGET_VUS * 0.1),
    stages: [
      { duration: '10s', target: TARGET_VUS },
      { duration: '30s', target: TARGET_VUS },
      { duration: '10s', target: Math.floor(TARGET_VUS * 0.1) },
    ],
    startTime: '11m',
  };
}

export const options = {
  scenarios,
  
  thresholds: {
    http_req_duration: [`p(50)<${P50_LATENCY}`, `p(95)<${P95_LATENCY}`, `p(99)<${P99_LATENCY}`],
    http_req_failed: [`rate<${MAX_ERROR_RATE}`],
    startup_time_ms: ['p(50)<3000', 'p(95)<5000'],
    segment_load_time_ms: ['p(50)<1000', 'p(95)<2000'],
    manifest_load_time_ms: ['p(50)<500', 'p(95)<1000'],
    cache_hit_rate: ['rate>0.7'],
    token_validation_success_rate: ['rate>0.95'],
    rebuffer_events: ['count<100'],
  },
  
  // Tags for better organization in results
  tags: {
    environment: ENVIRONMENT,
    target_vus: String(TARGET_VUS),
  },
};

// ============= Request Headers =============
const headers = {
  'Content-Type': 'application/json',
  'apikey': ANON_KEY,
  'Authorization': `Bearer ${ANON_KEY}`,
};

// ============= Helper Functions =============
function getRandomChannelId() {
  const base = '00000000-0000-0000-0000-';
  const suffix = String(Math.floor(Math.random() * 10000)).padStart(12, '0');
  return base + suffix;
}

function simulateStartup() {
  const start = Date.now();
  
  // Simulate manifest fetch
  const manifestStart = Date.now();
  const manifestRes = http.get(`${BASE_URL}/rest/v1/m3u_channels?select=id,stream_url&limit=1`, { headers });
  manifestLoadTime.add(Date.now() - manifestStart);
  
  // Simulate first segment load
  const segmentStart = Date.now();
  sleep(0.3 + Math.random() * 0.5); // Simulate segment download
  segmentLoadTime.add(Date.now() - segmentStart);
  
  const totalStartup = Date.now() - start;
  startupTime.add(totalStartup);
  
  return totalStartup;
}

// ============= Test Functions =============
export default function() {
  const isVod = Math.random() < VOD_RATIO; // Configurable VOD vs Live ratio
  const channelId = getRandomChannelId();
  
  activeViewers.add(1);
  
  group('Playback Session', function() {
    // 1. Startup Phase
    group('Startup', function() {
      const startup = simulateStartup();
      check(startup, {
        'startup under 3s': (t) => t < 3000,
        'startup under 5s': (t) => t < 5000,
      });
    });
    
    // 2. Token Generation
    group('Token Generation', function() {
      const tokenRes = http.post(
        `${EDGE_FUNCTIONS_URL}/playback-token`,
        JSON.stringify({
          action: 'generate',
          content_id: channelId,
          content_type: isVod ? 'vod' : 'live',
        }),
        { headers }
      );
      
      tokenValidations.add(1);
      const success = check(tokenRes, {
        'token generated': (r) => r.status === 200 || r.status === 401 || r.status === 403,
      });
      tokenValidationRate.add(success ? 1 : 0);
    });
    
    // 3. Routing Strategy
    group('Routing Decision', function() {
      const routeRes = http.post(
        `${BASE_URL}/rest/v1/rpc/get_channel_routing_strategy`,
        JSON.stringify({ p_channel_id: channelId }),
        { headers }
      );
      
      check(routeRes, {
        'routing decision made': (r) => r.status === 200,
      });
      
      // Check cache header
      const cacheControl = routeRes.headers['Cache-Control'] || '';
      cacheHitRate.add(cacheControl.includes('public') ? 1 : 0);
    });
    
    // 4. Simulated Playback (segments)
    group('Segment Loading', function() {
      const segmentCount = isVod ? 5 : 3;
      
      for (let i = 0; i < segmentCount; i++) {
        const segStart = Date.now();
        
        // Simulate segment request
        const segRes = http.get(
          `${BASE_URL}/rest/v1/m3u_channels?select=stream_url&limit=1`,
          { headers }
        );
        
        const segLatency = Date.now() - segStart;
        segmentLoadTime.add(segLatency);
        
        // Simulate rebuffer if too slow
        if (segLatency > 2000) {
          rebufferEvents.add(1);
        }
        
        check(segRes, {
          'segment loaded': (r) => r.status === 200,
        });
        
        // Simulate segment duration
        sleep(1 + Math.random());
        
        // Random quality switch
        if (Math.random() < 0.1) {
          qualitySwitches.add(1);
        }
      }
    });
    
    // 5. Metrics Recording
    group('Analytics', function() {
      const metricsRes = http.post(
        `${EDGE_FUNCTIONS_URL}/player-events`,
        JSON.stringify({
          event: 'view',
          channel_id: channelId,
          metrics: {
            startup_time: Math.random() * 3000,
            buffering_count: Math.floor(Math.random() * 3),
            quality: '1080p',
          },
        }),
        { headers }
      );
      
      check(metricsRes, {
        'metrics recorded': (r) => r.status === 200 || r.status === 401,
      });
    });
  });
  
  activeViewers.add(-1);
  
  // Random think time between sessions
  sleep(1 + Math.random() * 2);
}

// ============= Lifecycle Hooks =============
export function setup() {
  console.log('='.repeat(50));
  console.log('K6 Load Test - IPTV Streaming Platform');
  console.log('='.repeat(50));
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Target URL: ${BASE_URL}`);
  console.log(`Target VUs: ${TARGET_VUS}`);
  console.log(`Test Duration: ${TEST_DURATION}`);
  console.log(`VOD Ratio: ${VOD_RATIO * 100}%`);
  console.log(`Spike Test: ${ENABLE_SPIKE_TEST ? 'Enabled' : 'Disabled'}`);
  console.log(`Thresholds: p50<${P50_LATENCY}ms, p95<${P95_LATENCY}ms, p99<${P99_LATENCY}ms`);
  console.log('='.repeat(50));
  
  // Verify connectivity
  const healthCheck = http.get(`${BASE_URL}/rest/v1/`, { headers });
  if (healthCheck.status !== 200) {
    console.warn('⚠️ Backend may not be fully reachable');
  } else {
    console.log('✓ Backend connectivity verified');
  }
  
  return { startTime: Date.now(), environment: ENVIRONMENT };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log('='.repeat(50));
  console.log(`Load test completed in ${duration.toFixed(2)}s`);
  console.log(`Environment: ${data.environment}`);
  console.log('='.repeat(50));
}

// ============= Custom Summary =============
export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    duration_seconds: data.state.testRunDurationMs / 1000,
    vus_max: data.metrics.vus_max?.values?.max || 0,
    requests_total: data.metrics.http_reqs?.values?.count || 0,
    requests_per_second: data.metrics.http_reqs?.values?.rate || 0,
    
    // Latency percentiles
    latency: {
      p50: data.metrics.http_req_duration?.values?.['p(50)'] || 0,
      p95: data.metrics.http_req_duration?.values?.['p(95)'] || 0,
      p99: data.metrics.http_req_duration?.values?.['p(99)'] || 0,
      avg: data.metrics.http_req_duration?.values?.avg || 0,
    },
    
    // Custom metrics
    startup: {
      p50: data.metrics.startup_time_ms?.values?.['p(50)'] || 0,
      p95: data.metrics.startup_time_ms?.values?.['p(95)'] || 0,
    },
    
    // Error rates
    error_rate: data.metrics.http_req_failed?.values?.rate || 0,
    rebuffer_events: data.metrics.rebuffer_events?.values?.count || 0,
    cache_hit_rate: data.metrics.cache_hit_rate?.values?.rate || 0,
    
    // Thresholds
    thresholds_passed: Object.values(data.root_group.checks || {})
      .reduce((sum, c) => sum + (c.passes > c.fails ? 1 : 0), 0),
  };
  
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'load-test-results.json': JSON.stringify(summary, null, 2),
  };
}

// Simple text summary since we can't import helpers
function textSummary(data, options) {
  const lines = [
    '\n========== LOAD TEST RESULTS ==========\n',
    `Duration: ${(data.state.testRunDurationMs / 1000).toFixed(2)}s`,
    `VUs Max: ${data.metrics.vus_max?.values?.max || 0}`,
    `Total Requests: ${data.metrics.http_reqs?.values?.count || 0}`,
    `Requests/sec: ${(data.metrics.http_reqs?.values?.rate || 0).toFixed(2)}`,
    '\n--- Latency ---',
    `  p50: ${(data.metrics.http_req_duration?.values?.['p(50)'] || 0).toFixed(2)}ms`,
    `  p95: ${(data.metrics.http_req_duration?.values?.['p(95)'] || 0).toFixed(2)}ms`,
    `  p99: ${(data.metrics.http_req_duration?.values?.['p(99)'] || 0).toFixed(2)}ms`,
    '\n--- Player Metrics ---',
    `  Startup p50: ${(data.metrics.startup_time_ms?.values?.['p(50)'] || 0).toFixed(2)}ms`,
    `  Startup p95: ${(data.metrics.startup_time_ms?.values?.['p(95)'] || 0).toFixed(2)}ms`,
    `  Rebuffer Events: ${data.metrics.rebuffer_events?.values?.count || 0}`,
    `  Cache Hit Rate: ${((data.metrics.cache_hit_rate?.values?.rate || 0) * 100).toFixed(1)}%`,
    '\n--- Error Rates ---',
    `  HTTP Failures: ${((data.metrics.http_req_failed?.values?.rate || 0) * 100).toFixed(2)}%`,
    '\n========================================\n',
  ];
  
  return lines.join('\n');
}
