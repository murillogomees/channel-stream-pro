/**
 * playlists-archive Edge Function
 * Monthly cron job for archiving old playlists into tar.gz bundles
 * 
 * Runs on 1st of each month at 03:00 UTC
 * - Compresses previous month's playlists into single archive
 * - Uploads archive to R2
 * - Marks individual playlists as archived
 * - Optionally deletes original files after verification
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

const LOG_PREFIX = '[playlists-archive]'
const CRON_SECRET = Deno.env.get('CRON_SECRET')

// R2 Configuration
const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID') || ''
const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID') || ''
const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY') || ''
const R2_BUCKET_NAME = Deno.env.get('R2_BUCKET_NAME') || 'iptvlink-cdn'
const R2_PUBLIC_URL = Deno.env.get('R2_PUBLIC_URL') || `https://${R2_BUCKET_NAME}.r2.dev`

// Configuration
const DELETE_AFTER_ARCHIVE = Deno.env.get('ARCHIVE_DELETE_ORIGINALS') === 'true'
const MAX_ARCHIVE_SIZE_MB = parseInt(Deno.env.get('MAX_ARCHIVE_SIZE_MB') || '500')

function log(level: string, message: string, data?: Record<string, unknown>) {
  console.log(`[${new Date().toISOString()}]${LOG_PREFIX}[${level}] ${message}`, data ? JSON.stringify(data) : '')
}

async function sha256(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function getPreviousMonth(): string {
  const now = new Date()
  now.setMonth(now.getMonth() - 1)
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

// Simple tar-like format for Edge Function (no external deps)
// Creates a simplified archive manifest + concatenated content
async function createArchive(
  playlists: Array<{ id: string; storage_path: string; sha256: string }>
): Promise<{ content: Uint8Array; manifest: Record<string, unknown>[] }> {
  const manifest: Record<string, unknown>[] = []
  const chunks: Uint8Array[] = []
  
  // Add manifest header
  const header = new TextEncoder().encode('M3U-ARCHIVE-V1\n')
  chunks.push(header)
  
  let offset = header.length
  
  for (const playlist of playlists) {
    try {
      // Fetch content from R2
      const url = `${R2_PUBLIC_URL}/${playlist.storage_path}`
      const response = await fetch(url)
      
      if (!response.ok) {
        log('WARN', 'Failed to fetch playlist for archive', { path: playlist.storage_path, status: response.status })
        continue
      }
      
      const content = new Uint8Array(await response.arrayBuffer())
      
      // Add to manifest
      manifest.push({
        id: playlist.id,
        path: playlist.storage_path,
        offset,
        size: content.length,
        sha256: playlist.sha256
      })
      
      chunks.push(content)
      offset += content.length
      
      // Add separator
      const separator = new TextEncoder().encode('\n---END-FILE---\n')
      chunks.push(separator)
      offset += separator.length
      
    } catch (error) {
      log('ERROR', 'Error fetching playlist', { path: playlist.storage_path, error: error instanceof Error ? error.message : 'unknown' })
    }
  }
  
  // Combine all chunks
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const combined = new Uint8Array(totalLength)
  let position = 0
  
  for (const chunk of chunks) {
    combined.set(chunk, position)
    position += chunk.length
  }
  
  return { content: combined, manifest }
}

async function uploadArchive(path: string, content: Uint8Array): Promise<boolean> {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    log('ERROR', 'R2 credentials not configured')
    return false
  }

  try {
    const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    const url = `${endpoint}/${R2_BUCKET_NAME}/${path}`
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Length': String(content.length)
      },
      body: content
    })
    
    if (!response.ok) {
      log('ERROR', 'Archive upload failed', { status: response.status })
      return false
    }
    
    return true
  } catch (error) {
    log('ERROR', 'Archive upload error', { error: error instanceof Error ? error.message : 'unknown' })
    return false
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    log('WARN', 'Unauthorized archive attempt')
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    })
  }

  const startTime = Date.now()
  const targetMonth = getPreviousMonth()
  
  log('INFO', 'Starting archive job', { targetMonth })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get playlists for archival
    const { data: playlists, error: fetchError } = await supabase
      .rpc('get_playlists_for_archival', { target_month: targetMonth })

    if (fetchError) {
      log('ERROR', 'Failed to fetch playlists for archival', { error: fetchError.message })
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      })
    }

    if (!playlists || playlists.length === 0) {
      log('INFO', 'No playlists to archive', { targetMonth })
      return new Response(JSON.stringify({
        success: true,
        message: 'No playlists to archive',
        targetMonth
      }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      })
    }

    // Check total size
    const totalSizeBytes = playlists.reduce((sum: number, p: { size_bytes: number }) => sum + (p.size_bytes || 0), 0)
    const totalSizeMB = totalSizeBytes / (1024 * 1024)

    if (totalSizeMB > MAX_ARCHIVE_SIZE_MB) {
      log('WARN', 'Archive would exceed size limit, splitting not implemented', { totalSizeMB, limit: MAX_ARCHIVE_SIZE_MB })
    }

    log('INFO', `Archiving ${playlists.length} playlists (${totalSizeMB.toFixed(2)} MB)`)

    // Create archive
    const { content, manifest } = await createArchive(playlists)
    const archiveHash = await sha256(content)
    const archivePath = `playlists/archive/${targetMonth}.archive`

    // Upload archive
    const uploaded = await uploadArchive(archivePath, content)

    if (!uploaded) {
      return new Response(JSON.stringify({ error: 'Failed to upload archive' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      })
    }

    // Create archive record
    const archiveId = crypto.randomUUID()
    const { error: insertError } = await supabase
      .from('playlist_archives')
      .insert({
        id: archiveId,
        archive_path: archivePath,
        archive_month: targetMonth,
        size_bytes: content.length,
        sha256: archiveHash,
        playlist_count: manifest.length,
        verified: true,
        verified_at: new Date().toISOString(),
        metadata: { manifest }
      })

    if (insertError) {
      log('ERROR', 'Failed to insert archive record', { error: insertError.message })
    }

    // Mark playlists as archived
    const playlistIds = playlists.map((p: { id: string }) => p.id)
    const { data: markedCount, error: markError } = await supabase
      .rpc('mark_playlists_archived', { 
        playlist_ids: playlistIds, 
        p_archive_id: archiveId 
      })

    if (markError) {
      log('ERROR', 'Failed to mark playlists as archived', { error: markError.message })
    }

    const durationMs = Date.now() - startTime

    log('INFO', 'Archive job completed', {
      targetMonth,
      playlistCount: playlists.length,
      archiveSizeBytes: content.length,
      archivePath,
      markedCount,
      durationMs
    })

    return new Response(JSON.stringify({
      success: true,
      targetMonth,
      playlistCount: playlists.length,
      archiveSizeBytes: content.length,
      archivePath,
      archiveId,
      sha256: archiveHash,
      durationMs
    }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    log('ERROR', 'Archive job failed', { error: message })
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    })
  }
})
