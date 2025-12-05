/**
 * CDN Testing Utilities
 * 
 * Helper functions for testing CDN Worker integration
 */

import { cdnRoutingService } from '@/services/cdnRoutingService';
import { streamService, Channel } from '@/modules/player/services/StreamService';
import { supabase } from '@/integrations/supabase/client';

export interface CdnTestResult {
  stage: string;
  success: boolean;
  details: string;
  data?: any;
  error?: string;
}

/**
 * Comprehensive CDN integration test
 */
export async function testCdnIntegration(): Promise<CdnTestResult[]> {
  const results: CdnTestResult[] = [];

  // 1. Test secrets configuration
  console.log('[CDN Test] Stage 1: Testing secrets configuration...');
  try {
    const { data: config, error } = await supabase.functions.invoke('cdn-config');
    
    results.push({
      stage: 'Secrets Configuration',
      success: !error && !!config?.cdn_worker_url,
      details: error 
        ? `Error fetching config: ${error.message}`
        : `CDN Worker URL: ${config?.cdn_worker_url ? '✓ Configured' : '✗ Missing'}`,
      data: config,
      error: error?.message,
    });
  } catch (error) {
    results.push({
      stage: 'Secrets Configuration',
      success: false,
      details: 'Failed to fetch configuration',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // 2. Test CDN Worker health
  console.log('[CDN Test] Stage 2: Testing CDN Worker health...');
  try {
    const health = await cdnRoutingService.checkCdnWorkerHealth();
    
    results.push({
      stage: 'CDN Worker Health',
      success: health.status !== 'down',
      details: `Status: ${health.status}, Response Time: ${health.responseTime}ms`,
      data: health,
      error: health.error,
    });
  } catch (error) {
    results.push({
      stage: 'CDN Worker Health',
      success: false,
      details: 'Health check failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // 3. Test token generation
  console.log('[CDN Test] Stage 3: Testing JWT token generation...');
  try {
    const { generateCdnToken } = await import('@/services/r2CdnService');
    const tokenResult = await generateCdnToken({
      r2_key: 'test/manifest.m3u8',
      expires_in_seconds: 120,
      token_type: 'manifest',
    });

    results.push({
      stage: 'JWT Token Generation',
      success: tokenResult.success,
      details: tokenResult.success 
        ? `Token generated successfully (expires in 2min)`
        : `Failed: ${tokenResult.error}`,
      data: { hasToken: !!tokenResult.token },
      error: tokenResult.error,
    });
  } catch (error) {
    results.push({
      stage: 'JWT Token Generation',
      success: false,
      details: 'Token generation failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // 4. Test sample R2 content
  console.log('[CDN Test] Stage 4: Testing R2 content routing...');
  try {
    const { data: r2Objects } = await supabase
      .from('r2_storage_objects')
      .select('*')
      .eq('status', 'ready')
      .limit(1)
      .single();

    if (r2Objects) {
      const testChannel: Channel = {
        id: r2Objects.source_channel_id || 'test',
        name: 'Test Channel',
        stream_url: r2Objects.source_url || 'http://test.com',
        r2_uploaded: true,
        r2_url: r2Objects.cdn_url,
        content_type: 'vod',
        category_name: 'Test',
      };

      const playbackResult = await cdnRoutingService.getPlaybackUrl(testChannel);

      results.push({
        stage: 'R2 Content Routing',
        success: playbackResult.source === 'cdn_worker' || playbackResult.source === 'r2_direct',
        details: `Route: ${playbackResult.source}, Token: ${playbackResult.requiresToken ? 'Yes' : 'No'}`,
        data: playbackResult,
      });
    } else {
      // Check if there are pending downloads
      const { count: pendingCount } = await supabase
        .from('r2_storage_objects')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (pendingCount && pendingCount > 0) {
        results.push({
          stage: 'R2 Content Routing',
          success: true, // Not a failure - just pending
          details: `${pendingCount} download(s) em progresso. Aguarde conclusão para testar roteamento.`,
        });
      } else {
        results.push({
          stage: 'R2 Content Routing',
          success: true, // Config is OK, just no content yet
          details: 'Nenhum conteúdo no R2. Faça upload de VOD para testar roteamento.',
        });
      }
    }
  } catch (error) {
    results.push({
      stage: 'R2 Content Routing',
      success: false,
      details: 'Failed to test R2 routing',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // 5. Test routing metrics
  console.log('[CDN Test] Stage 5: Testing routing metrics...');
  try {
    const metrics = cdnRoutingService.getRoutingMetrics();
    
    results.push({
      stage: 'Routing Metrics',
      success: true,
      details: `CDN Requests: ${metrics.cdn_worker_requests}, Proxy: ${metrics.stream_proxy_requests}, Fallbacks: ${metrics.fallback_count}`,
      data: metrics,
    });
  } catch (error) {
    results.push({
      stage: 'Routing Metrics',
      success: false,
      details: 'Failed to get metrics',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return results;
}

/**
 * Test CDN Worker direct access
 */
export async function testCdnWorkerDirect(workerUrl: string): Promise<{
  success: boolean;
  responseTime: number;
  error?: string;
}> {
  const start = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${workerUrl}/health`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - start;

    return {
      success: response.ok,
      responseTime,
      error: response.ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      success: false,
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Log test results to console in a formatted way
 */
export function logTestResults(results: CdnTestResult[]): void {
  console.group('🧪 CDN Integration Test Results');
  
  results.forEach((result, index) => {
    const icon = result.success ? '✅' : '❌';
    console.group(`${icon} ${index + 1}. ${result.stage}`);
    console.log('Details:', result.details);
    if (result.data) console.log('Data:', result.data);
    if (result.error) console.error('Error:', result.error);
    console.groupEnd();
  });
  
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  
  console.log(`\n📊 Summary: ${successCount}/${totalCount} tests passed`);
  console.groupEnd();
}

/**
 * Run all CDN tests and log results
 */
export async function runCdnTests(): Promise<void> {
  console.log('🚀 Starting CDN integration tests...\n');
  
  const results = await testCdnIntegration();
  logTestResults(results);
  
  return;
}

// Make available on window for console testing
if (typeof window !== 'undefined') {
  (window as any).testCdn = runCdnTests;
  (window as any).cdnRoutingService = cdnRoutingService;
  console.log('💡 CDN testing utilities loaded. Run window.testCdn() to test integration.');
}
