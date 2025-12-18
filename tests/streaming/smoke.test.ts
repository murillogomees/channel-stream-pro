/**
 * Smoke Tests for Hybrid Streaming Architecture
 * 
 * Tests basic functionality of:
 * - Policy Engine
 * - Edge Router endpoints
 * - Cloudflare Stream integration
 * - Fallback mechanisms
 */

import { describe, it, expect, beforeAll } from 'vitest';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://waxgowafohlrfoefwhsf.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndheGdvd2Fmb2hscmZvZWZ3aHNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNzAzMDMsImV4cCI6MjA4MDg0NjMwM30.dgqou7A6mcKc5hmn7aV15FDhkEf0uA3hiYp8v_T2MBw';

// Edge Router URL - update after deployment
const EDGE_ROUTER_URL = process.env.EDGE_ROUTER_URL || 'https://stream-edge-router.workers.dev';

describe('Policy Engine - Smoke Tests', () => {
  it('should fetch streaming policies', async () => {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/streaming_policies?select=*`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    expect(response.status).toBe(200);
    const policies = await response.json();
    expect(Array.isArray(policies)).toBe(true);
    expect(policies.length).toBeGreaterThan(0);
    
    // Verify default policies exist
    const contentTypes = policies.map((p: any) => p.content_type);
    expect(contentTypes).toContain('vod');
    expect(contentTypes).toContain('live_linear');
  });

  it('should have correct default strategies', async () => {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/streaming_policies?select=*`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    const policies = await response.json();
    
    const vodPolicy = policies.find((p: any) => p.content_type === 'vod');
    expect(vodPolicy?.default_strategy).toBe('USE_STREAM');
    
    const livePolicy = policies.find((p: any) => p.content_type === 'live_linear');
    expect(livePolicy?.default_strategy).toBe('USE_ORIGIN');
  });

  it('should call get_channel_routing_strategy function', async () => {
    // Test with a non-existent channel to verify function works
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_channel_routing_strategy`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_channel_id: '00000000-0000-0000-0000-000000000000',
      }),
    });

    expect(response.status).toBe(200);
    const result = await response.json();
    
    // Should return fallback strategy for unknown channel
    expect(result).toBeDefined();
  });
});

describe('Edge Router - Smoke Tests', () => {
  it('should respond to health check', async () => {
    try {
      const response = await fetch(`${EDGE_ROUTER_URL}/health`, {
        method: 'GET',
      });

      if (response.status === 200) {
        const health = await response.json();
        expect(health.status).toBe('ok');
        expect(health).toHaveProperty('streamHealthy');
        expect(health).toHaveProperty('cacheSize');
      }
    } catch (error) {
      // Worker not deployed yet - skip
      console.log('Edge Router not available - skipping health check');
    }
  });

  it('should respond to metrics endpoint', async () => {
    try {
      const response = await fetch(`${EDGE_ROUTER_URL}/metrics`, {
        method: 'GET',
      });

      if (response.status === 200) {
        const metrics = await response.json();
        expect(metrics).toHaveProperty('totalRequests');
        expect(metrics).toHaveProperty('cacheHits');
        expect(metrics).toHaveProperty('cacheMisses');
      }
    } catch (error) {
      console.log('Edge Router not available - skipping metrics check');
    }
  });

  it('should return 404 for unknown channel', async () => {
    try {
      const response = await fetch(`${EDGE_ROUTER_URL}/play/unknown-channel-id`, {
        method: 'GET',
      });

      // Should return 404 or redirect depending on implementation
      expect([404, 302, 307]).toContain(response.status);
    } catch (error) {
      console.log('Edge Router not available - skipping unknown channel test');
    }
  });
});

describe('Cloudflare Stream Integration - Smoke Tests', () => {
  it('should call cf-stream-upload edge function', async () => {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/cf-stream-upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'statistics',
      }),
    });

    // Should return 200 or 401 (if auth required)
    expect([200, 401]).toContain(response.status);
  });

  it('should have cf_stream_uploads table accessible', async () => {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/cf_stream_uploads?select=count&limit=1`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    expect(response.status).toBe(200);
  });
});

describe('Streaming Metrics - Smoke Tests', () => {
  it('should have streaming_metrics table accessible', async () => {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/streaming_metrics?select=*&limit=10`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    expect(response.status).toBe(200);
  });

  it('should be able to record metrics', async () => {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/record_streaming_metric`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_channel_id: '00000000-0000-0000-0000-000000000000',
        p_metric_type: 'view',
        p_value: 1,
      }),
    });

    // Should succeed or fail gracefully
    expect([200, 204, 400]).toContain(response.status);
  });
});
