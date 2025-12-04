import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const STORAGE_BUCKET = Deno.env.get('STORAGE_BUCKET') || 'playlists';
const DEFAULT_SIGNED_URL_EXPIRES = parseInt(Deno.env.get('SIGNED_URL_EXPIRES') || '3600');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  // Get user from auth header
  const authHeader = req.headers.get('authorization');
  let userId: string | null = null;
  let isAdmin = false;
  
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      if (user) {
        userId = user.id;
        
        // Check if admin
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .in('role', ['admin', 'master'])
          .single();
        
        isAdmin = !!roleData;
      }
    } catch {
      // Continue without auth
    }
  }
  
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  
  // Remove 'playlists' from path if present
  const playlistIdIndex = pathParts.findIndex(p => p === 'playlists') + 1;
  const playlistId = pathParts[playlistIdIndex] || null;
  
  try {
    // GET /playlists - List playlists
    if (req.method === 'GET' && !playlistId) {
      const params = {
        p_user_id: isAdmin ? (url.searchParams.get('user_id') || null) : userId,
        p_from: url.searchParams.get('from') ? new Date(url.searchParams.get('from')!).toISOString() : null,
        p_to: url.searchParams.get('to') ? new Date(url.searchParams.get('to')!).toISOString() : null,
        p_limit: parseInt(url.searchParams.get('limit') || '50'),
        p_offset: parseInt(url.searchParams.get('offset') || '0'),
        p_include_archived: url.searchParams.get('include_archived') === 'true',
      };
      
      const { data, error } = await supabase.rpc('list_playlists', params);
      
      if (error) throw error;
      
      // Get total count for pagination
      let countQuery = supabase.from('playlists').select('id', { count: 'exact', head: true });
      if (!isAdmin && userId) {
        countQuery = countQuery.eq('user_id', userId);
      }
      if (!params.p_include_archived) {
        countQuery = countQuery.eq('archived', false);
      }
      
      const { count } = await countQuery;
      
      return new Response(JSON.stringify({
        data,
        pagination: {
          total: count || 0,
          limit: params.p_limit,
          offset: params.p_offset,
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // GET /playlists/:id - Get single playlist with signed URL
    if (req.method === 'GET' && playlistId) {
      const { data: playlist, error } = await supabase
        .rpc('get_playlist_metadata', { p_id: playlistId });
      
      if (error) throw error;
      if (!playlist || playlist.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Playlist not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const record = playlist[0];
      
      // Check access
      if (!isAdmin && record.user_id !== userId) {
        return new Response(
          JSON.stringify({ error: 'Access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Generate signed URL
      const expiresIn = parseInt(url.searchParams.get('expires') || String(DEFAULT_SIGNED_URL_EXPIRES));
      const { data: signedData } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(record.storage_path, expiresIn);
      
      return new Response(JSON.stringify({
        ...record,
        signedUrl: signedData?.signedUrl || null,
        signedUrlExpiresIn: expiresIn,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // DELETE /playlists/:id - Delete playlist
    if (req.method === 'DELETE' && playlistId) {
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'Authentication required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Get playlist to check ownership and get storage path
      const { data: playlist } = await supabase
        .rpc('get_playlist_metadata', { p_id: playlistId });
      
      if (!playlist || playlist.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Playlist not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const record = playlist[0];
      
      // Check access
      if (!isAdmin && record.user_id !== userId) {
        return new Response(
          JSON.stringify({ error: 'Access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Delete from storage
      if (record.storage_path) {
        await supabase.storage.from(STORAGE_BUCKET).remove([record.storage_path]);
      }
      
      // Delete from database
      const { data: deleted, error } = await supabase
        .rpc('delete_playlist', { p_id: playlistId, p_user_id: userId });
      
      if (error) throw error;
      
      return new Response(JSON.stringify({ 
        success: true, 
        deleted: playlistId 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('playlists error:', message);
    
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
