/**
 * playlists-api Edge Function
 * CRUD operations for playlist management
 * 
 * GET /playlists - List playlists with pagination
 * GET /playlists/{id} - Get playlist details with signed URL
 * DELETE /playlists/{id} - Delete playlist (admin/owner only)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS'
}

const LOG_PREFIX = '[playlists-api]'

function log(level: string, message: string, data?: Record<string, unknown>) {
  console.log(`[${new Date().toISOString()}]${LOG_PREFIX}[${level}] ${message}`, data ? JSON.stringify(data) : '')
}

// Generate signed URL for R2 (simplified - use Cloudflare Worker for production)
function getPublicUrl(storagePath: string): string {
  const publicUrl = Deno.env.get('R2_PUBLIC_URL') || 'https://iptvlink-cdn.r2.dev'
  return `${publicUrl}/${storagePath}`
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const url = new URL(req.url)
    const pathParts = url.pathname.split('/').filter(Boolean)
    
    // Extract playlist ID from path if present
    // Path could be /playlists-api or /playlists-api/{id}
    const playlistId = pathParts.length > 1 ? pathParts[pathParts.length - 1] : null

    // Verify authentication
    const authHeader = req.headers.get('authorization')
    let userId: string | null = null
    let isAdmin = false

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error } = await supabase.auth.getUser(token)
      
      if (!error && user) {
        userId = user.id
        
        // Check if admin
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .in('role', ['admin', 'master'])
          .single()
        
        isAdmin = !!roles
      }
    }

    // GET /playlists - List playlists
    if (req.method === 'GET' && !playlistId) {
      const fromDate = url.searchParams.get('from')
      const toDate = url.searchParams.get('to')
      const userFilter = url.searchParams.get('user_id')
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)
      const offset = parseInt(url.searchParams.get('offset') || '0')
      const archived = url.searchParams.get('archived') === 'true'

      let query = supabase
        .from('playlists')
        .select('id, filename, storage_path, user_id, channel_count, unique_count, quarantined_count, size_bytes, created_at, expires_at, archived', { count: 'exact' })
        .eq('archived', archived)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      // Apply filters
      if (fromDate) query = query.gte('created_at', fromDate)
      if (toDate) query = query.lte('created_at', toDate)
      
      // Non-admins can only see their own playlists
      if (!isAdmin && userId) {
        query = query.eq('user_id', userId)
      } else if (userFilter && isAdmin) {
        query = query.eq('user_id', userFilter)
      }

      const { data, error, count } = await query

      if (error) {
        log('ERROR', 'Failed to list playlists', { error: error.message })
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({
        playlists: data,
        total: count,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit
      }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      })
    }

    // GET /playlists/{id} - Get playlist details
    if (req.method === 'GET' && playlistId) {
      const { data: playlist, error } = await supabase
        .from('playlists')
        .select('*')
        .eq('id', playlistId)
        .single()

      if (error || !playlist) {
        return new Response(JSON.stringify({ error: 'Playlist not found' }), {
          status: 404,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        })
      }

      // Check access
      if (!isAdmin && playlist.user_id !== userId) {
        return new Response(JSON.stringify({ error: 'Access denied' }), {
          status: 403,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        })
      }

      // Generate signed URL
      const expiresIn = parseInt(url.searchParams.get('expiresIn') || '3600') // Default 1 hour
      const storageUrl = getPublicUrl(playlist.storage_path)

      // Log access
      await supabase.from('playlist_access_logs').insert({
        playlist_id: playlistId,
        user_id: userId,
        access_type: 'view',
        ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
        user_agent: req.headers.get('user-agent')
      })

      return new Response(JSON.stringify({
        ...playlist,
        storageUrl,
        expiresIn
      }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      })
    }

    // DELETE /playlists/{id} - Delete playlist
    if (req.method === 'DELETE' && playlistId) {
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        })
      }

      // Get playlist
      const { data: playlist, error } = await supabase
        .from('playlists')
        .select('id, user_id, storage_path')
        .eq('id', playlistId)
        .single()

      if (error || !playlist) {
        return new Response(JSON.stringify({ error: 'Playlist not found' }), {
          status: 404,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        })
      }

      // Check permission (admin or owner)
      if (!isAdmin && playlist.user_id !== userId) {
        return new Response(JSON.stringify({ error: 'Access denied' }), {
          status: 403,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        })
      }

      // Delete from database (R2 cleanup via lifecycle or separate job)
      const { error: deleteError } = await supabase
        .from('playlists')
        .delete()
        .eq('id', playlistId)

      if (deleteError) {
        log('ERROR', 'Failed to delete playlist', { error: deleteError.message })
        return new Response(JSON.stringify({ error: deleteError.message }), {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        })
      }

      log('INFO', 'Playlist deleted', { playlistId, userId })

      return new Response(JSON.stringify({ success: true, deleted: playlistId }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    log('ERROR', 'Request failed', { error: message })
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    })
  }
})
