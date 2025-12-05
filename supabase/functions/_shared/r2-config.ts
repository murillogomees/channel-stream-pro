/**
 * R2 Configuration Helper
 * 
 * Shared configuration for Cloudflare R2 across all Edge Functions
 * Bucket: iptvlink-cdn (primary bucket for all CDN operations)
 * 
 * Uses native fetch with AWS4 signing (no npm dependencies)
 * 
 * @version 2.0.0
 */

// =============================================
// CONSTANTS
// =============================================

/** Primary R2 bucket name - DO NOT CHANGE without coordinating all services */
export const R2_BUCKET_NAME = 'iptvlink-cdn';

/** CDN base URL for public access */
export const R2_CDN_BASE_URL = 'https://cdn.iptvlink.app';

/** Environment prefix for keys */
export const R2_ENV = Deno.env.get('ENVIRONMENT') || 'production';

// =============================================
// CONFIGURATION
// =============================================

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  cdnBaseUrl: string;
  environment: string;
}

/**
 * Get R2 configuration from environment
 * Validates all required env vars are present
 */
export function getR2Config(): R2Config {
  const accountId = Deno.env.get('R2_ACCOUNT_ID') || Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID');
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY');
  const bucketName = Deno.env.get('R2_BUCKET_NAME') || R2_BUCKET_NAME;
  const cdnBaseUrl = Deno.env.get('R2_CDN_BASE_URL') || R2_CDN_BASE_URL;
  const environment = Deno.env.get('ENVIRONMENT') || 'production';

  if (!accountId) {
    throw new Error('R2_ACCOUNT_ID or CLOUDFLARE_ACCOUNT_ID is required');
  }
  if (!accessKeyId) {
    throw new Error('R2_ACCESS_KEY_ID is required');
  }
  if (!secretAccessKey) {
    throw new Error('R2_SECRET_ACCESS_KEY is required');
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    cdnBaseUrl,
    environment,
  };
}

/**
 * Check if R2 is properly configured
 * Returns detailed status without throwing
 */
export function checkR2Config(): { configured: boolean; missing: string[]; config?: Partial<R2Config> } {
  const missing: string[] = [];
  
  const accountId = Deno.env.get('R2_ACCOUNT_ID') || Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID');
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY');

  if (!accountId) missing.push('R2_ACCOUNT_ID');
  if (!accessKeyId) missing.push('R2_ACCESS_KEY_ID');
  if (!secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY');

  return {
    configured: missing.length === 0,
    missing,
    config: missing.length === 0 ? {
      accountId,
      bucketName: Deno.env.get('R2_BUCKET_NAME') || R2_BUCKET_NAME,
      cdnBaseUrl: Deno.env.get('R2_CDN_BASE_URL') || R2_CDN_BASE_URL,
    } : undefined,
  };
}

// =============================================
// AWS4 SIGNING (Native implementation)
// =============================================

async function hmacSha256(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
}

async function sha256(message: string | Uint8Array): Promise<string> {
  const data = typeof message === 'string' ? new TextEncoder().encode(message) : message;
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function getSignatureKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string
): Promise<ArrayBuffer> {
  const kDate = await hmacSha256(new TextEncoder().encode('AWS4' + secretKey), dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, 'aws4_request');
}

interface SignedRequest {
  url: string;
  headers: Record<string, string>;
}

async function signRequest(
  method: string,
  url: string,
  headers: Record<string, string>,
  body: string | Uint8Array | null,
  config: R2Config
): Promise<SignedRequest> {
  const parsedUrl = new URL(url);
  const region = 'auto';
  const service = 's3';
  
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);
  
  // Payload hash
  let payloadHash: string;
  if (body === null) {
    payloadHash = await sha256('');
  } else if (typeof body === 'string') {
    payloadHash = await sha256(body);
  } else {
    payloadHash = await sha256(body);
  }
  
  // Canonical headers
  const signedHeaders: Record<string, string> = {
    ...headers,
    'host': parsedUrl.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
  
  const sortedHeaderKeys = Object.keys(signedHeaders).sort();
  const canonicalHeaders = sortedHeaderKeys
    .map(key => `${key.toLowerCase()}:${signedHeaders[key].trim()}`)
    .join('\n') + '\n';
  const signedHeadersStr = sortedHeaderKeys.map(k => k.toLowerCase()).join(';');
  
  // Canonical request
  const canonicalUri = parsedUrl.pathname;
  const canonicalQuerystring = parsedUrl.search.substring(1);
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeadersStr,
    payloadHash,
  ].join('\n');
  
  // String to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    await sha256(canonicalRequest),
  ].join('\n');
  
  // Signature
  const signingKey = await getSignatureKey(config.secretAccessKey, dateStamp, region, service);
  const signatureBuffer = await hmacSha256(signingKey, stringToSign);
  const signature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // Authorization header
  const authorizationHeader = `${algorithm} Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeadersStr}, Signature=${signature}`;
  
  return {
    url,
    headers: {
      ...signedHeaders,
      'Authorization': authorizationHeader,
    },
  };
}

// =============================================
// KEY GENERATION
// =============================================

export type ContentCategory = 'vod' | 'live' | 'playlist' | 'thumbnail' | 'manifest' | 'segment' | 'backup';

/**
 * Generate standardized R2 object key
 * Format: iptvlink/{env}/{category}/{identifier}[.{extension}]
 */
export function generateR2Key(
  category: ContentCategory,
  identifier: string,
  extension?: string
): string {
  const env = Deno.env.get('ENVIRONMENT') || 'production';
  const key = `iptvlink/${env}/${category}/${identifier}`;
  return extension ? `${key}.${extension}` : key;
}

/**
 * Generate R2 key for channel content
 */
export function generateChannelKey(
  channelId: string,
  filename: string,
  category: ContentCategory = 'vod'
): string {
  return `iptvlink/${R2_ENV}/${category}/${channelId}/${filename}`;
}

/**
 * Generate R2 key for M3U playlist
 */
export function generatePlaylistKey(
  listId: string,
  variant?: string
): string {
  const filename = variant ? `${listId}_${variant}.m3u` : `${listId}.m3u`;
  return `iptvlink/${R2_ENV}/playlist/${filename}`;
}

/**
 * Parse R2 key to extract components
 */
export function parseR2Key(key: string): {
  prefix: string;
  env: string;
  category: string;
  identifier: string;
  extension?: string;
} | null {
  const match = key.match(/^iptvlink\/([^/]+)\/([^/]+)\/(.+?)(?:\.([^.]+))?$/);
  if (!match) return null;
  
  return {
    prefix: 'iptvlink',
    env: match[1],
    category: match[2],
    identifier: match[3],
    extension: match[4],
  };
}

// =============================================
// MIME TYPES
// =============================================

const MIME_TYPES: Record<string, string> = {
  // Video
  'm3u8': 'application/vnd.apple.mpegurl',
  'ts': 'video/mp2t',
  'mp4': 'video/mp4',
  'webm': 'video/webm',
  'mkv': 'video/x-matroska',
  'avi': 'video/x-msvideo',
  // Audio
  'mp3': 'audio/mpeg',
  'aac': 'audio/aac',
  'm4a': 'audio/mp4',
  // Images
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'gif': 'image/gif',
  'webp': 'image/webp',
  // Playlist
  'm3u': 'audio/x-mpegurl',
  // Other
  'json': 'application/json',
  'xml': 'application/xml',
  'txt': 'text/plain',
};

/**
 * Get MIME type from filename or extension
 */
export function getMimeType(filenameOrExt: string): string {
  const ext = filenameOrExt.includes('.') 
    ? filenameOrExt.split('.').pop()?.toLowerCase() 
    : filenameOrExt.toLowerCase();
  
  return MIME_TYPES[ext || ''] || 'application/octet-stream';
}

/**
 * Check if content type is video
 */
export function isVideoContent(mimeType: string): boolean {
  return mimeType.startsWith('video/') || mimeType === 'application/vnd.apple.mpegurl';
}

// =============================================
// CDN URL GENERATION
// =============================================

/**
 * Generate public CDN URL for an object
 */
export function getCdnUrl(key: string, customBaseUrl?: string): string {
  const baseUrl = customBaseUrl || Deno.env.get('R2_CDN_BASE_URL') || R2_CDN_BASE_URL;
  return `${baseUrl}/${key}`;
}

// =============================================
// R2 OPERATIONS (Using native fetch)
// =============================================

function getR2Endpoint(config: R2Config): string {
  return `https://${config.accountId}.r2.cloudflarestorage.com`;
}

export interface UploadOptions {
  key: string;
  body: Uint8Array | string | ReadableStream;
  contentType?: string;
  metadata?: Record<string, string>;
  cacheControl?: string;
}

/**
 * Upload content to R2
 */
export async function uploadToR2(options: UploadOptions): Promise<{ success: boolean; key: string; cdnUrl: string; size?: number }> {
  const config = getR2Config();
  const endpoint = getR2Endpoint(config);
  const url = `${endpoint}/${config.bucketName}/${options.key}`;
  
  const contentType = options.contentType || getMimeType(options.key);
  
  // Default cache headers for CDN optimization
  const cacheControl = options.cacheControl || (
    contentType.includes('m3u8') 
      ? 'public, max-age=10, s-maxage=30' 
      : 'public, max-age=3600, s-maxage=86400'
  );

  // Convert body to Uint8Array for signing
  let bodyBytes: Uint8Array;
  if (typeof options.body === 'string') {
    bodyBytes = new TextEncoder().encode(options.body);
  } else if (options.body instanceof Uint8Array) {
    bodyBytes = options.body;
  } else {
    // ReadableStream - read all chunks
    const chunks: Uint8Array[] = [];
    const reader = options.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    bodyBytes = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      bodyBytes.set(chunk, offset);
      offset += chunk.length;
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'Cache-Control': cacheControl,
    'Content-Length': bodyBytes.length.toString(),
  };

  // Add metadata headers
  if (options.metadata) {
    for (const [key, value] of Object.entries(options.metadata)) {
      headers[`x-amz-meta-${key}`] = value;
    }
  }

  const signed = await signRequest('PUT', url, headers, bodyBytes, config);
  
  const response = await fetch(signed.url, {
    method: 'PUT',
    headers: signed.headers,
    body: bodyBytes,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`R2 upload failed: ${response.status} - ${errorText}`);
  }

  return {
    success: true,
    key: options.key,
    cdnUrl: getCdnUrl(options.key),
    size: bodyBytes.length,
  };
}

/**
 * Delete object from R2
 */
export async function deleteFromR2(key: string): Promise<boolean> {
  const config = getR2Config();
  const endpoint = getR2Endpoint(config);
  const url = `${endpoint}/${config.bucketName}/${key}`;

  const signed = await signRequest('DELETE', url, {}, null, config);
  
  const response = await fetch(signed.url, {
    method: 'DELETE',
    headers: signed.headers,
  });

  if (!response.ok && response.status !== 204) {
    const errorText = await response.text();
    throw new Error(`R2 delete failed: ${response.status} - ${errorText}`);
  }

  return true;
}

/**
 * Check if object exists in R2
 */
export async function objectExists(key: string): Promise<boolean> {
  const config = getR2Config();
  const endpoint = getR2Endpoint(config);
  const url = `${endpoint}/${config.bucketName}/${key}`;

  try {
    const signed = await signRequest('HEAD', url, {}, null, config);
    
    const response = await fetch(signed.url, {
      method: 'HEAD',
      headers: signed.headers,
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get object from R2
 */
export async function getFromR2(key: string): Promise<{ body: Uint8Array; contentType: string } | null> {
  const config = getR2Config();
  const endpoint = getR2Endpoint(config);
  const url = `${endpoint}/${config.bucketName}/${key}`;

  const signed = await signRequest('GET', url, {}, null, config);
  
  const response = await fetch(signed.url, {
    method: 'GET',
    headers: signed.headers,
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    const errorText = await response.text();
    throw new Error(`R2 get failed: ${response.status} - ${errorText}`);
  }

  const body = new Uint8Array(await response.arrayBuffer());
  const contentType = response.headers.get('Content-Type') || 'application/octet-stream';

  return { body, contentType };
}

/**
 * List objects with prefix
 */
export async function listObjects(
  prefix: string, 
  maxKeys: number = 1000
): Promise<{ keys: string[]; truncated: boolean }> {
  const config = getR2Config();
  const endpoint = getR2Endpoint(config);
  const url = `${endpoint}/${config.bucketName}?list-type=2&prefix=${encodeURIComponent(prefix)}&max-keys=${maxKeys}`;

  const signed = await signRequest('GET', url, {}, null, config);
  
  const response = await fetch(signed.url, {
    method: 'GET',
    headers: signed.headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`R2 list failed: ${response.status} - ${errorText}`);
  }

  const xml = await response.text();
  
  // Simple XML parsing for keys
  const keys: string[] = [];
  const keyMatches = xml.matchAll(/<Key>([^<]+)<\/Key>/g);
  for (const match of keyMatches) {
    keys.push(match[1]);
  }
  
  const truncated = xml.includes('<IsTruncated>true</IsTruncated>');

  return { keys, truncated };
}

// =============================================
// HEALTH CHECK
// =============================================

/**
 * Test R2 connection and permissions
 */
export async function testR2Connection(): Promise<{
  connected: boolean;
  bucket: string;
  canRead: boolean;
  canWrite: boolean;
  error?: string;
}> {
  const result = {
    connected: false,
    bucket: '',
    canRead: false,
    canWrite: false,
    error: undefined as string | undefined,
  };

  try {
    const config = getR2Config();
    result.bucket = config.bucketName;
    
    // Test read permission (list objects)
    try {
      await listObjects('_health_', 1);
      result.canRead = true;
      result.connected = true;
    } catch (e) {
      result.error = `Read failed: ${(e as Error).message}`;
    }

    // Test write permission (upload and delete test object)
    if (result.canRead) {
      try {
        const testKey = `_health_check_${Date.now()}.txt`;
        await uploadToR2({
          key: testKey,
          body: 'health_check',
          contentType: 'text/plain',
        });
        
        await deleteFromR2(testKey);
        result.canWrite = true;
      } catch (e) {
        result.error = `Write failed: ${(e as Error).message}`;
      }
    }

    return result;
  } catch (error) {
    result.error = (error as Error).message;
    return result;
  }
}
