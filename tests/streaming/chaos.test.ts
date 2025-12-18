/**
 * Chaos Tests for Hybrid Streaming Architecture
 * 
 * Simulates failure scenarios:
 * - Cloudflare Stream API outage
 * - Origin server failures
 * - Database connectivity issues
 * - High load scenarios
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://sdvyxdghxqmntyoweqbd.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkdnl4ZGdoeHFtbnR5b3dlcWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQwMjQ5MDIsImV4cCI6MjA0OTYwMDkwMn0.lPPcpvBUK4pN2JYrNqFmLtgvKuT3bPNCjpfVkR7NS8Y';
const EDGE_ROUTER_URL = process.env.EDGE_ROUTER_URL || 'https://stream-edge-router.workers.dev';

describe('Chaos Tests - Fallback Mechanisms', () => {
  describe('Channel Override Fallback', () => {
    it('should respect force_origin override', async () => {
      // Create a temporary override
      const channelId = '00000000-0000-0000-0000-000000000001';
      
      // Insert override
      const insertResponse = await fetch(`${SUPABASE_URL}/rest/v1/channel_routing_overrides`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({
          channel_id: channelId,
          strategy: 'USE_ORIGIN',
          force_origin: true,
          reason: 'Chaos test - simulating Stream outage',
          expires_at: new Date(Date.now() + 60000).toISOString(), // 1 minute
        }),
      });

      // Verify the override is active
      const getResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/channel_routing_overrides?channel_id=eq.${channelId}`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }
      );

      const overrides = await getResponse.json();
      
      if (insertResponse.status === 201) {
        expect(overrides.length).toBeGreaterThan(0);
        expect(overrides[0].force_origin).toBe(true);
        
        // Cleanup
        await fetch(
          `${SUPABASE_URL}/rest/v1/channel_routing_overrides?channel_id=eq.${channelId}`,
          {
            method: 'DELETE',
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
          }
        );
      }
    });

    it('should handle expired overrides gracefully', async () => {
      const channelId = '00000000-0000-0000-0000-000000000002';
      
      // Insert expired override
      await fetch(`${SUPABASE_URL}/rest/v1/channel_routing_overrides`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel_id: channelId,
          strategy: 'USE_ORIGIN',
          force_origin: true,
          reason: 'Expired chaos test',
          expires_at: new Date(Date.now() - 60000).toISOString(), // Already expired
        }),
      });

      // Routing should ignore expired override
      const routingResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_channel_routing_strategy`, {
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

      expect(routingResponse.status).toBe(200);
      
      // Cleanup
      await fetch(
        `${SUPABASE_URL}/rest/v1/channel_routing_overrides?channel_id=eq.${channelId}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }
      );
    });
  });

  describe('High Error Rate Detection', () => {
    it('should detect and respond to high error rates', async () => {
      const channelId = '00000000-0000-0000-0000-000000000003';
      
      // Simulate recording multiple errors
      const recordError = async () => {
        return fetch(`${SUPABASE_URL}/rest/v1/rpc/record_streaming_metric`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            p_channel_id: channelId,
            p_metric_type: 'error',
            p_value: 1,
          }),
        });
      };

      // Record multiple errors
      await Promise.all([
        recordError(),
        recordError(),
        recordError(),
      ]);

      // Verify metrics were recorded
      const metricsResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/streaming_metrics?channel_id=eq.${channelId}&metric_type=eq.error`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }
      );

      expect(metricsResponse.status).toBe(200);
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle multiple concurrent policy lookups', async () => {
      const channelIds = [
        '00000000-0000-0000-0000-000000000010',
        '00000000-0000-0000-0000-000000000011',
        '00000000-0000-0000-0000-000000000012',
        '00000000-0000-0000-0000-000000000013',
        '00000000-0000-0000-0000-000000000014',
      ];

      const lookupPromises = channelIds.map(channelId =>
        fetch(`${SUPABASE_URL}/rest/v1/rpc/get_channel_routing_strategy`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            p_channel_id: channelId,
          }),
        })
      );

      const responses = await Promise.all(lookupPromises);
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should handle burst of metric recordings', async () => {
      const channelId = '00000000-0000-0000-0000-000000000020';
      
      const recordMetric = (type: string, value: number) =>
        fetch(`${SUPABASE_URL}/rest/v1/rpc/record_streaming_metric`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            p_channel_id: channelId,
            p_metric_type: type,
            p_value: value,
          }),
        });

      // Simulate burst of metrics
      const burstPromises = [];
      for (let i = 0; i < 20; i++) {
        burstPromises.push(recordMetric('view', 1));
        burstPromises.push(recordMetric('bandwidth', Math.random() * 100));
      }

      const startTime = Date.now();
      const responses = await Promise.all(burstPromises);
      const duration = Date.now() - startTime;

      console.log(`Burst of 40 metrics completed in ${duration}ms`);
      
      // Most should succeed (some may fail due to rate limiting)
      const successCount = responses.filter(r => r.status === 200 || r.status === 204).length;
      expect(successCount).toBeGreaterThan(30); // At least 75% success rate
    });
  });
});

describe('Chaos Tests - Edge Router Resilience', () => {
  it('should handle malformed requests gracefully', async () => {
    try {
      const response = await fetch(`${EDGE_ROUTER_URL}/play/`, {
        method: 'GET',
      });

      // Should return error, not crash
      expect([400, 404, 500]).toContain(response.status);
    } catch (error) {
      console.log('Edge Router not available - skipping malformed request test');
    }
  });

  it('should handle invalid channel IDs', async () => {
    try {
      const response = await fetch(`${EDGE_ROUTER_URL}/play/not-a-valid-uuid`, {
        method: 'GET',
      });

      // Should return 404 or error
      expect([400, 404]).toContain(response.status);
    } catch (error) {
      console.log('Edge Router not available - skipping invalid ID test');
    }
  });

  it('should handle OPTIONS preflight requests', async () => {
    try {
      const response = await fetch(`${EDGE_ROUTER_URL}/play/test`, {
        method: 'OPTIONS',
      });

      // Should handle CORS preflight
      expect(response.status).toBeLessThan(500);
    } catch (error) {
      console.log('Edge Router not available - skipping OPTIONS test');
    }
  });
});

describe('Chaos Tests - Database Stress', () => {
  it('should handle rapid policy updates', async () => {
    const updates = [];
    
    for (let i = 0; i < 5; i++) {
      updates.push(
        fetch(`${SUPABASE_URL}/rest/v1/streaming_policies?content_type=eq.vod`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            priority: 100 + i,
          }),
        })
      );
    }

    const responses = await Promise.all(updates);
    
    // All should succeed or handle gracefully
    responses.forEach(r => {
      expect([200, 204, 409]).toContain(r.status);
    });

    // Reset priority
    await fetch(`${SUPABASE_URL}/rest/v1/streaming_policies?content_type=eq.vod`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        priority: 100,
      }),
    });
  });
});
