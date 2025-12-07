import { supabase } from '@/integrations/supabase/client';

interface UploadOptions {
  contentType?: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
}

interface SignedUrlResponse {
  success: boolean;
  uploadUrl?: string;
  publicUrl?: string;
  key?: string;
  error?: string;
}

interface R2Config {
  useR2: boolean;
  publicDomain: string;
}

class R2StorageService {
  private config: R2Config = {
    useR2: false,
    publicDomain: '',
  };

  async initialize(): Promise<void> {
    try {
      const { data } = await supabase
        .from('r2_migration_config')
        .select('key, value')
        .in('key', ['USE_R2_STORAGE', 'R2_PUBLIC_DOMAIN']);

      if (data) {
        data.forEach(item => {
          if (item.key === 'USE_R2_STORAGE') {
            this.config.useR2 = item.value === 'true' || item.value === true;
          }
          if (item.key === 'R2_PUBLIC_DOMAIN') {
            this.config.publicDomain = String(item.value).replace(/"/g, '');
          }
        });
      }
    } catch (error) {
      console.warn('[R2Storage] Failed to load config:', error);
    }
  }

  isEnabled(): boolean {
    return this.config.useR2;
  }

  /**
   * Get a signed URL for direct upload to R2
   */
  async getSignedUploadUrl(
    key: string,
    contentType: string,
    ttlSeconds: number = 3600
  ): Promise<SignedUrlResponse> {
    try {
      const { data, error } = await supabase.functions.invoke('r2-signed-upload', {
        body: { key, contentType, ttlSeconds, operation: 'PUT' }
      });

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('[R2Storage] Failed to get signed URL:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Upload a file directly to R2 using a signed URL
   */
  async uploadFile(
    key: string,
    file: File | Blob,
    options: UploadOptions = {}
  ): Promise<{ success: boolean; publicUrl?: string; error?: string }> {
    try {
      const contentType = options.contentType || file.type || 'application/octet-stream';
      
      // Get signed URL
      const signedResult = await this.getSignedUploadUrl(key, contentType);
      if (!signedResult.success || !signedResult.uploadUrl) {
        throw new Error(signedResult.error || 'Failed to get signed URL');
      }

      // Upload directly to R2
      const uploadResponse = await fetch(signedResult.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
          ...(options.cacheControl && { 'Cache-Control': options.cacheControl }),
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }

      return {
        success: true,
        publicUrl: signedResult.publicUrl,
      };
    } catch (error: any) {
      console.error('[R2Storage] Upload failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get the public CDN URL for a key
   */
  getPublicUrl(key: string): string {
    if (this.config.publicDomain) {
      return `https://${this.config.publicDomain}/${key}`;
    }
    // Fallback to direct R2 URL (not recommended for production)
    return key;
  }

  /**
   * Resolve the best URL for an asset (R2 if synced, fallback to original)
   */
  resolveAssetUrl(
    r2Path: string | null | undefined,
    isSynced: boolean | null | undefined,
    fallbackUrl: string
  ): string {
    if (this.config.useR2 && isSynced && r2Path) {
      return this.getPublicUrl(r2Path);
    }
    return fallbackUrl;
  }

  /**
   * Check if an asset should be served from R2
   */
  shouldUseR2(isSynced: boolean | null | undefined): boolean {
    return this.config.useR2 && isSynced === true;
  }
}

export const r2StorageService = new R2StorageService();

// Initialize on module load
r2StorageService.initialize().catch(console.error);
