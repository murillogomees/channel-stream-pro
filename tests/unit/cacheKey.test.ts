/**
 * Cache Key Normalization Tests
 * 
 * Unit tests for cache key generation and normalization logic.
 */

import { describe, it, expect } from 'vitest';

/**
 * Generates a normalized cache key from a URL
 * 
 * Rules:
 * 1. Normalize query parameter order (alphabetical)
 * 2. Strip tracking parameters (utm_*, fbclid, etc.)
 * 3. Normalize protocol (http/https)
 * 4. Strip trailing slashes
 * 5. Lowercase domain
 */
export function generateCacheKey(url: string): string {
  try {
    const parsedUrl = new URL(url);
    
    // 1. Lowercase domain
    const domain = parsedUrl.hostname.toLowerCase();
    
    // 2. Normalize path (strip trailing slash unless root)
    let path = parsedUrl.pathname;
    if (path !== '/' && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    
    // 3. Sort and filter query params
    const params = new URLSearchParams(parsedUrl.search);
    const filteredParams = new URLSearchParams();
    
    // Strip tracking params
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid', '_ga'];
    
    // Sort params alphabetically and exclude tracking
    Array.from(params.entries())
      .filter(([key]) => !trackingParams.includes(key))
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([key, value]) => filteredParams.append(key, value));
    
    // 4. Reconstruct normalized URL
    const normalizedQuery = filteredParams.toString();
    const normalizedUrl = `${domain}${path}${normalizedQuery ? '?' + normalizedQuery : ''}`;
    
    return normalizedUrl;
  } catch (error) {
    // If URL parsing fails, return original string as fallback
    console.error('Cache key generation error:', error);
    return url;
  }
}

describe('generateCacheKey', () => {
  it('normalizes query param order', () => {
    const url1 = 'https://example.com/page?b=2&a=1';
    const url2 = 'https://example.com/page?a=1&b=2';
    
    expect(generateCacheKey(url1)).toBe(generateCacheKey(url2));
  });

  it('strips UTM params', () => {
    const url1 = 'https://example.com/page?utm_source=facebook&id=123';
    const url2 = 'https://example.com/page?id=123';
    
    expect(generateCacheKey(url1)).toBe(generateCacheKey(url2));
  });

  it('strips multiple tracking params', () => {
    const url = 'https://example.com/page?id=1&utm_source=fb&utm_campaign=summer&fbclid=xyz&gclid=abc';
    const expected = 'example.com/page?id=1';
    
    expect(generateCacheKey(url)).toBe(expected);
  });

  it('normalizes domain to lowercase', () => {
    const url1 = 'https://Example.COM/page?id=1';
    const url2 = 'https://example.com/page?id=1';
    
    expect(generateCacheKey(url1)).toBe(generateCacheKey(url2));
  });

  it('strips trailing slashes', () => {
    const url1 = 'https://example.com/page/';
    const url2 = 'https://example.com/page';
    
    expect(generateCacheKey(url1)).toBe(generateCacheKey(url2));
  });

  it('preserves root path trailing slash', () => {
    const url = 'https://example.com/';
    const expected = 'example.com/';
    
    expect(generateCacheKey(url)).toBe(expected);
  });

  it('handles URLs with no query params', () => {
    const url = 'https://example.com/page';
    const expected = 'example.com/page';
    
    expect(generateCacheKey(url)).toBe(expected);
  });

  it('handles URLs with fragments (ignores them)', () => {
    const url = 'https://example.com/page?id=1#section';
    // URL constructor automatically strips fragments
    const expected = 'example.com/page?id=1';
    
    expect(generateCacheKey(url)).toBe(expected);
  });

  it('preserves important query params', () => {
    const url = 'https://example.com/api/stream?channelId=abc123&quality=720p&utm_source=facebook';
    const expected = 'example.com/api/stream?channelId=abc123&quality=720p';
    
    expect(generateCacheKey(url)).toBe(expected);
  });

  it('handles complex URLs with multiple params', () => {
    const url = 'https://CDN.Example.com/video/stream.m3u8?token=xyz&expires=123&quality=1080p&utm_campaign=test&b=2&a=1';
    const expected = 'cdn.example.com/video/stream.m3u8?a=1&b=2&expires=123&quality=1080p&token=xyz';
    
    expect(generateCacheKey(url)).toBe(expected);
  });
});
