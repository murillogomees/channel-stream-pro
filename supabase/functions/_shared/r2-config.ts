/**
 * R2 Configuration Helper
 * 
 * Shared configuration for Cloudflare R2 across all Edge Functions
 * Bucket: iptvlink-cdn (primary bucket for all CDN operations)
 * 
 * @version 1.0.0
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command } from "npm:@aws-sdk/client-s3";

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
// S3 CLIENT
// =============================================

let _r2Client: S3Client | null = null;

/**
 * Get or create R2 S3-compatible client
 * Singleton pattern for efficiency
 */
export function getR2Client(): S3Client {
  if (_r2Client) return _r2Client;

  const config = getR2Config();
  
  _r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return _r2Client;
}

/**
 * Reset client (useful for testing or credential rotation)
 */
export function resetR2Client(): void {
  _r2Client = null;
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

/**
 * Generate signed URL for temporary access (not implemented - requires Worker)
 */
export function getSignedUrl(_key: string, _expiresInSeconds: number = 3600): string {
  // Note: R2 signed URLs require Cloudflare Workers, not S3 presigned URLs
  throw new Error('Signed URLs require Cloudflare Worker implementation');
}

// =============================================
// UPLOAD HELPERS
// =============================================

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
  const client = getR2Client();
  const config = getR2Config();
  
  const contentType = options.contentType || getMimeType(options.key);
  
  // Default cache headers for CDN optimization
  const cacheControl = options.cacheControl || (
    contentType.includes('m3u8') 
      ? 'public, max-age=10, s-maxage=30' 
      : 'public, max-age=3600, s-maxage=86400'
  );

  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: options.key,
    Body: options.body,
    ContentType: contentType,
    CacheControl: cacheControl,
    Metadata: options.metadata,
  });

  await client.send(command);
  
  return {
    success: true,
    key: options.key,
    cdnUrl: getCdnUrl(options.key),
    size: typeof options.body === 'string' 
      ? new TextEncoder().encode(options.body).length 
      : options.body instanceof Uint8Array 
        ? options.body.length 
        : undefined,
  };
}

/**
 * Delete object from R2
 */
export async function deleteFromR2(key: string): Promise<boolean> {
  const client = getR2Client();
  const config = getR2Config();

  const command = new DeleteObjectCommand({
    Bucket: config.bucketName,
    Key: key,
  });

  await client.send(command);
  return true;
}

/**
 * Check if object exists in R2
 */
export async function objectExists(key: string): Promise<boolean> {
  const client = getR2Client();
  const config = getR2Config();

  try {
    const command = new HeadObjectCommand({
      Bucket: config.bucketName,
      Key: key,
    });
    await client.send(command);
    return true;
  } catch (error) {
    if ((error as any).name === 'NotFound' || (error as any).$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * List objects with prefix
 */
export async function listObjects(
  prefix: string, 
  maxKeys: number = 1000
): Promise<{ keys: string[]; truncated: boolean }> {
  const client = getR2Client();
  const config = getR2Config();

  const command = new ListObjectsV2Command({
    Bucket: config.bucketName,
    Prefix: prefix,
    MaxKeys: maxKeys,
  });

  const response = await client.send(command);
  
  return {
    keys: response.Contents?.map(obj => obj.Key || '').filter(Boolean) || [],
    truncated: response.IsTruncated || false,
  };
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
    
    const client = getR2Client();
    
    // Test read permission
    try {
      const listCommand = new ListObjectsV2Command({
        Bucket: config.bucketName,
        MaxKeys: 1,
      });
      await client.send(listCommand);
      result.canRead = true;
      result.connected = true;
    } catch (e) {
      result.error = `Read failed: ${(e as Error).message}`;
    }

    // Test write permission (upload and delete test object)
    if (result.canRead) {
      try {
        const testKey = `_health_check_${Date.now()}.txt`;
        const putCommand = new PutObjectCommand({
          Bucket: config.bucketName,
          Key: testKey,
          Body: 'health_check',
          ContentType: 'text/plain',
        });
        await client.send(putCommand);
        
        const deleteCommand = new DeleteObjectCommand({
          Bucket: config.bucketName,
          Key: testKey,
        });
        await client.send(deleteCommand);
        
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

// =============================================
// EXPORTS
// =============================================

export {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
};
