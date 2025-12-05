/**
 * Image URL validation utilities
 */

// Invalid URL patterns that should be rejected
const INVALID_URL_PATTERNS = [
  '/_small.', '/_medium.', '/_large.',  // URLs with empty filename
  '/images/_',                           // Common broken URL pattern
  'None', 'undefined', 'null',           // String representations of null values
];

/**
 * Validates if a URL is a valid image URL
 * Rejects malformed URLs that would cause network errors
 */
export function isValidImageUrl(url: string | undefined | null): url is string {
  if (!url || typeof url !== 'string') return false;
  
  // Check for invalid patterns
  if (INVALID_URL_PATTERNS.some(p => url.includes(p))) return false;
  
  try {
    const pathname = new URL(url, 'http://localhost').pathname;
    const filename = pathname.split('/').pop() || '';
    
    // Reject URLs with filenames starting with underscore or dot (invalid)
    if (filename.startsWith('_') || filename.startsWith('.')) return false;
    
    // Reject URLs with very short pathnames (likely invalid)
    if (pathname.length < 5) return false;
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets a safe image URL or returns undefined
 * Use this when you want to conditionally render images
 */
export function getSafeImageUrl(url: string | undefined | null): string | undefined {
  return isValidImageUrl(url) ? url : undefined;
}
