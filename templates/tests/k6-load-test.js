/**
 * k6 Load Test Baseline Script
 * 
 * Tests:
 * 1. API Health Check
 * 2. Authentication Flow
 * 3. Stream Playback
 * 4. CDN Performance
 * 
 * Run: k6 run templates/tests/k6-load-test.js
 * 
 * Environment Variables:
 * - BASE_URL: API base URL
 * - CDN_URL: CDN base URL  
 * - TEST_USER_EMAIL: Test user email
 * - TEST_USER_PASSWORD: Test user password
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiLatency = new Trend('api_latency');
const cdnLatency = new Trend('cdn_latency');
const streamLatency = new Trend('stream_latency');
const authSuccessRate = new Rate('auth_success');
const cacheHitRate = new Rate('cache_hits');
const requestCount = new Counter('requests');

// Configuration
export const options = {
  stages: [
    // Ramp up
    { duration: '30s', target: 10 },   // Warm up
    { duration: '1m', target: 50 },    // Ramp to 50 users
    { duration: '3m', target: 50 },    // Stay at 50 users
    { duration: '1m', target: 100 },   // Ramp to 100 users
    { duration: '3m', target: 100 },   // Stay at 100 users
    { duration: '1m', target: 200 },   // Peak load
    { duration: '2m', target: 200 },   // Sustain peak
    { duration: '1m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    errors: ['rate<0.01'],              // Less than 1% errors
    api_latency: ['p(95)<300'],         // API p95 < 300ms
    cdn_latency: ['p(95)<100'],         // CDN p95 < 100ms
    auth_success: ['rate>0.99'],        // 99%+ auth success
    cache_hits: ['rate>0.80'],          // 80%+ cache hit rate
  },
};

// Environment configuration
const BASE_URL = __ENV.BASE_URL || 'https://api.iptvlink.app';
const CDN_URL = __ENV.CDN_URL || 'https://cdn.iptvlink.app';
const TEST_EMAIL = __ENV.TEST_USER_EMAIL || 'test@example.com';
const TEST_PASSWORD = __ENV.TEST_USER_PASSWORD || 'testpassword123';

// Shared state
let authToken = null;
let userId = null;

// Test scenarios
export default function () {
  group('1. Health Check', () => {
    const res = http.get(`${BASE_URL}/health`);
    requestCount.add(1);
    
    const success = check(res, {
      'health check status 200': (r) => r.status === 200,
      'health check response time < 500ms': (r) => r.timings.duration < 500,
    });
    
    errorRate.add(!success);
    apiLatency.add(res.timings.duration);
  });

  group('2. Authentication', () => {
    // Login
    const loginRes = http.post(
      `${BASE_URL}/auth/v1/token?grant_type=password`,
      JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'apikey': __ENV.SUPABASE_ANON_KEY,
        },
      }
    );
    requestCount.add(1);

    const loginSuccess = check(loginRes, {
      'login status 200': (r) => r.status === 200,
      'login has access_token': (r) => {
        try {
          const body = JSON.parse(r.body);
          authToken = body.access_token;
          userId = body.user?.id;
          return !!authToken;
        } catch {
          return false;
        }
      },
    });

    authSuccessRate.add(loginSuccess);
    apiLatency.add(loginRes.timings.duration);
    
    sleep(0.5);
  });

  if (authToken) {
    group('3. API Requests', () => {
      // Fetch channels
      const channelsRes = http.get(
        `${BASE_URL}/rest/v1/m3u_channels?select=id,name,stream_url&limit=10`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'apikey': __ENV.SUPABASE_ANON_KEY,
          },
        }
      );
      requestCount.add(1);

      const channelsSuccess = check(channelsRes, {
        'channels status 200': (r) => r.status === 200,
        'channels has data': (r) => {
          try {
            const body = JSON.parse(r.body);
            return Array.isArray(body) && body.length > 0;
          } catch {
            return false;
          }
        },
      });

      errorRate.add(!channelsSuccess);
      apiLatency.add(channelsRes.timings.duration);

      // Fetch user profile
      const profileRes = http.get(
        `${BASE_URL}/rest/v1/user_profiles?user_id=eq.${userId}&limit=1`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'apikey': __ENV.SUPABASE_ANON_KEY,
          },
        }
      );
      requestCount.add(1);

      check(profileRes, {
        'profile status 200': (r) => r.status === 200,
      });

      apiLatency.add(profileRes.timings.duration);
      
      sleep(1);
    });

    group('4. CDN Performance', () => {
      // Test CDN manifest fetch
      const manifestRes = http.get(
        `${CDN_URL}/test/master.m3u8?token=${authToken}`,
        {
          headers: {
            'Accept': 'application/vnd.apple.mpegurl',
          },
        }
      );
      requestCount.add(1);

      const manifestSuccess = check(manifestRes, {
        'manifest status 200 or 404': (r) => r.status === 200 || r.status === 404,
        'manifest response time < 200ms': (r) => r.timings.duration < 200,
      });

      errorRate.add(!manifestSuccess && manifestRes.status !== 404);
      cdnLatency.add(manifestRes.timings.duration);

      // Check cache status
      const cacheStatus = manifestRes.headers['Cf-Cache-Status'] || 
                          manifestRes.headers['X-Cache'] || '';
      cacheHitRate.add(cacheStatus.includes('HIT'));

      // Test CDN segment fetch (simulated)
      const segmentRes = http.get(
        `${CDN_URL}/test/segment001.ts?token=${authToken}`,
        {
          headers: {
            'Accept': 'video/mp2t',
          },
        }
      );
      requestCount.add(1);

      check(segmentRes, {
        'segment response time < 500ms': (r) => r.timings.duration < 500,
      });

      cdnLatency.add(segmentRes.timings.duration);
      
      sleep(0.5);
    });

    group('5. Stream Simulation', () => {
      // Simulate stream playback pattern
      // Initial manifest fetch
      const startTime = Date.now();
      
      http.get(`${CDN_URL}/live/channel1/index.m3u8?token=${authToken}`);
      requestCount.add(1);

      // Fetch 5 segments (simulating 10 seconds of playback)
      for (let i = 0; i < 5; i++) {
        const segRes = http.get(
          `${CDN_URL}/live/channel1/segment${String(i).padStart(4, '0')}.ts?token=${authToken}`
        );
        requestCount.add(1);
        
        cdnLatency.add(segRes.timings.duration);
        
        // Check cache
        const cacheStatus = segRes.headers['Cf-Cache-Status'] || '';
        cacheHitRate.add(cacheStatus === 'HIT');
        
        sleep(2); // 2 second segments
      }

      const totalTime = Date.now() - startTime;
      streamLatency.add(totalTime);
    });
  }

  // Cooldown
  sleep(Math.random() * 2);
}

// Setup function - runs once before test
export function setup() {
  console.log('Starting load test...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`CDN URL: ${CDN_URL}`);
  
  // Verify services are up
  const healthCheck = http.get(`${BASE_URL}/health`);
  if (healthCheck.status !== 200) {
    throw new Error('API health check failed');
  }
  
  return { startTime: Date.now() };
}

// Teardown function - runs once after test
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Test completed in ${duration.toFixed(2)} seconds`);
}

// Handle test summary
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'load-test-results.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';
  let summary = '\n';
  summary += `${indent}LOAD TEST SUMMARY\n`;
  summary += `${indent}${'='.repeat(50)}\n\n`;
  
  // Key metrics
  summary += `${indent}Requests: ${data.metrics.requests?.values?.count || 0}\n`;
  summary += `${indent}Error Rate: ${(data.metrics.errors?.values?.rate * 100 || 0).toFixed(2)}%\n`;
  summary += `${indent}API p95: ${data.metrics.api_latency?.values?.['p(95)']?.toFixed(2) || 0}ms\n`;
  summary += `${indent}CDN p95: ${data.metrics.cdn_latency?.values?.['p(95)']?.toFixed(2) || 0}ms\n`;
  summary += `${indent}Cache Hit Rate: ${(data.metrics.cache_hits?.values?.rate * 100 || 0).toFixed(2)}%\n`;
  summary += `${indent}Auth Success Rate: ${(data.metrics.auth_success?.values?.rate * 100 || 0).toFixed(2)}%\n`;
  
  // Thresholds
  summary += `\n${indent}THRESHOLDS\n`;
  for (const [name, threshold] of Object.entries(data.metrics)) {
    if (threshold.thresholds) {
      for (const [key, value] of Object.entries(threshold.thresholds)) {
        const status = value.ok ? '✓' : '✗';
        summary += `${indent}  ${status} ${name}.${key}\n`;
      }
    }
  }
  
  return summary;
}
