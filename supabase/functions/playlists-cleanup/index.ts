/**
 * playlists-cleanup Edge Function
 * Daily cron job for cleaning expired playlists and pruning old versions
 * 
 * Runs at 02:00 UTC daily
 * - Deletes expired playlists from R2
 * - Removes database records for expired items
 * - Prunes old versions keeping only N per user
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

const LOG_PREFIX = '[playlists-cleanup]'
const CRON_SECRET = Deno.env.get('CRON_SECRET')

// R2 Configuration
const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID') || ''
const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID') || ''
const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY') || ''
const R2_BUCKET_NAME = Deno.env.get('R2_BUCKET_NAME') || 'iptvlink-cdn'

// Configuration
const KEEP_VERSIONS = parseInt(Deno.env.get('PLAYLIST_KEEP_VERSIONS') || '3')
const BATCH_SIZE = 50

function log(level: string, message: string, data?: Record<string, unknown>) {
  console.log(`[${new Date().toISOString()}]${LOG_PREFIX}[${level}] ${message}`, data ? JSON.stringify(data) : '')
}

async function sha256(content: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(content)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function deleteFromR2(path: string): Promise<boolean> {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    log('WARN', 'R2 credentials not configured, skipping R2 delete')
    return true
  }

  try {
    const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    const url = `${endpoint}/${R2_BUCKET_NAME}/${path}`
    
    const date = new Date()
    const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '')
    const dateStamp = date.toISOString().slice(0, 10).replace(/-/g, '')
    
    const headers: Record<string, string> = {
      'Host': `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': await sha256('')
    }
    
    // Simplified delete - in production use full AWS4 signing
    const response = await fetch(url, {
      method: 'DELETE',
      headers
    })
    
    if (!response.ok && response.status !== 404) {
      log('WARN', 'R2 delete failed', { path, status: response.status })
      return false
    }
    
    return true
  } catch (error) {
    log('ERROR', 'R2 delete error', { path, error: error instanceof Error ? error.message : 'unknown' })
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
    log('WARN', 'Unauthorized cleanup attempt')
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    })
  }

  const startTime = Date.now()
  log('INFO', 'Starting playlist cleanup job')

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const stats = {
      expiredDeleted: 0,
      expiredR2Deleted: 0,
      versionsPruned: 0,
      errors: [] as string[]
    }

    // Step 1: Get expired playlists
    const { data: expiredPlaylists, error: fetchError } = await supabase
      .from('playlists')
      .select('id, storage_path')
      .eq('archived', false)
      .lt('expires_at', new Date().toISOString())
      .limit(BATCH_SIZE)

    if (fetchError) {
      log('ERROR', 'Failed to fetch expired playlists', { error: fetchError.message })
      stats.errors.push(`Fetch error: ${fetchError.message}`)
    } else if (expiredPlaylists && expiredPlaylists.length > 0) {
      log('INFO', `Found ${expiredPlaylists.length} expired playlists`)

      // Delete from R2
      for (const playlist of expiredPlaylists) {
        const deleted = await deleteFromR2(playlist.storage_path)
        if (deleted) stats.expiredR2Deleted++
      }

      // Delete from database
      const expiredIds = expiredPlaylists.map(p => p.id)
      const { error: deleteError, count } = await supabase
        .from('playlists')
        .delete()
        .in('id', expiredIds)

      if (deleteError) {
        log('ERROR', 'Failed to delete expired records', { error: deleteError.message })
        stats.errors.push(`Delete error: ${deleteError.message}`)
      } else {
        stats.expiredDeleted = count || 0
        log('INFO', `Deleted ${stats.expiredDeleted} expired playlists`)
      }
    }

    // Step 2: Prune old versions per user
    const { data: prunedCount, error: pruneError } = await supabase
      .rpc('prune_old_versions', { keep_versions: KEEP_VERSIONS })

    if (pruneError) {
      log('ERROR', 'Failed to prune old versions', { error: pruneError.message })
      stats.errors.push(`Prune error: ${pruneError.message}`)
    } else {
      stats.versionsPruned = prunedCount || 0
      if (stats.versionsPruned > 0) {
        log('INFO', `Pruned ${stats.versionsPruned} old versions`)
      }
    }

    const durationMs = Date.now() - startTime

    log('INFO', 'Cleanup job completed', {
      ...stats,
      durationMs
    })

    return new Response(JSON.stringify({
      success: true,
      stats,
      durationMs
    }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    log('ERROR', 'Cleanup job failed', { error: message })
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    })
  }
})
