import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.18';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-cron-secret',
};

let r2Client: AwsClient | null = null;

function getR2Client(): AwsClient {
  if (r2Client) return r2Client;
  
  const R2_ACCESS_KEY = Deno.env.get('R2_ACCESS_KEY_ID');
  const R2_SECRET_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY');
  
  if (!R2_ACCESS_KEY || !R2_SECRET_KEY) {
    throw new Error('R2 credentials not configured');
  }
  
  r2Client = new AwsClient({
    accessKeyId: R2_ACCESS_KEY,
    secretAccessKey: R2_SECRET_KEY,
    service: 's3',
  });
  
  return r2Client;
}

function getR2Endpoint(): string {
  const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID');
  const R2_BUCKET_NAME = Deno.env.get('R2_BUCKET_NAME');
  
  if (!R2_ACCOUNT_ID || !R2_BUCKET_NAME) {
    throw new Error('R2 account/bucket not configured');
  }
  
  return `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar autenticação via cron secret
    const cronSecret = req.headers.get('x-supabase-cron-secret');
    const expectedSecret = Deno.env.get('CRON_SECRET');

    if (cronSecret !== expectedSecret) {
      console.error('[CleanupVOD] Unauthorized cron attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🧹 [CleanupVOD] Iniciando limpeza de VOD...');

    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const client = getR2Client();
    const endpoint = getR2Endpoint();
    let deletedFiles = 0;
    let freedBytes = 0;

    // 1. Buscar canais deletados que ainda têm VOD no R2
    const { data: deletedChannels, error: deletedError } = await supabaseService
      .from('vod_downloads')
      .select('channel_id, r2_url, file_size_bytes')
      .eq('status', 'completed')
      .not('channel_id', 'in', `(
        SELECT id FROM m3u_channels
      )`);

    if (!deletedError && deletedChannels && deletedChannels.length > 0) {
      console.log(`🗑️  ${deletedChannels.length} VODs de canais deletados encontrados`);

      for (const channel of deletedChannels) {
        try {
          await deleteVODFromR2(channel.channel_id, client, endpoint);
          
          await supabaseService
            .from('vod_downloads')
            .delete()
            .eq('channel_id', channel.channel_id);

          deletedFiles++;
          freedBytes += channel.file_size_bytes || 0;
          
          console.log(`✅ VOD deletado: ${channel.channel_id}`);
        } catch (deleteError) {
          console.error(`❌ Erro ao deletar VOD ${channel.channel_id}:`, deleteError);
        }
      }
    }

    // 2. Buscar VODs de canais que não são mais VOD
    const { data: nonVODChannels, error: nonVODError } = await supabaseService
      .from('m3u_channels')
      .select('id')
      .eq('is_vod', false)
      .eq('r2_uploaded', true);

    if (!nonVODError && nonVODChannels && nonVODChannels.length > 0) {
      console.log(`🔄 ${nonVODChannels.length} canais mudaram de VOD para live`);

      for (const channel of nonVODChannels) {
        try {
          await deleteVODFromR2(channel.id, client, endpoint);
          
          await supabaseService
            .from('m3u_channels')
            .update({
              r2_uploaded: false,
              r2_url: null,
              r2_uploaded_at: null
            })
            .eq('id', channel.id);

          await supabaseService
            .from('vod_downloads')
            .delete()
            .eq('channel_id', channel.id);

          deletedFiles++;
          console.log(`✅ VOD removido (canal virou live): ${channel.id}`);
        } catch (deleteError) {
          console.error(`❌ Erro ao remover VOD ${channel.id}:`, deleteError);
        }
      }
    }

    // 3. Buscar VODs órfãos no R2 (arquivos sem registro no banco)
    const orphanedVODs = await findOrphanedVODsInR2(client, endpoint, supabaseService);
    
    if (orphanedVODs.length > 0) {
      console.log(`🔍 ${orphanedVODs.length} VODs órfãos encontrados no R2`);

      for (const orphanKey of orphanedVODs) {
        try {
          await client.fetch(`${endpoint}/${orphanKey}`, { method: 'DELETE' });
          deletedFiles++;
          console.log(`✅ VOD órfão deletado: ${orphanKey}`);
        } catch (deleteError) {
          console.error(`❌ Erro ao deletar VOD órfão ${orphanKey}:`, deleteError);
        }
      }
    }

    // 4. Limpar registros de download antigos (ignorar se RPC não existir)
    try {
      await supabaseService.rpc('cleanup_old_vod_downloads');
    } catch (rpcError) {
      console.log('⚠️ RPC cleanup_old_vod_downloads não disponível');
    }

    console.log(`✅ [CleanupVOD] Concluído: ${deletedFiles} arquivos deletados, ${(freedBytes / 1048576).toFixed(2)} MB liberados`);

    return new Response(
      JSON.stringify({ 
        success: true,
        deletedFiles,
        freedMB: (freedBytes / 1048576).toFixed(2)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ [CleanupVOD] Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Deletar todos os arquivos de um VOD do R2
 */
async function deleteVODFromR2(channelId: string, client: AwsClient, endpoint: string) {
  const prefix = `vod/${channelId}/`;

  // Listar todos os arquivos do VOD
  const listResponse = await client.fetch(`${endpoint}?prefix=${encodeURIComponent(prefix)}&list-type=2`, {
    method: 'GET',
  });

  if (!listResponse.ok) {
    console.error(`Erro ao listar objetos: ${listResponse.status}`);
    return;
  }

  const xml = await listResponse.text();
  const keyMatches = xml.matchAll(/<Key>([^<]+)<\/Key>/g);
  const keys: string[] = [];
  
  for (const match of keyMatches) {
    keys.push(match[1]);
  }

  if (keys.length === 0) {
    return;
  }

  // Deletar cada arquivo
  for (const key of keys) {
    await client.fetch(`${endpoint}/${key}`, { method: 'DELETE' });
  }

  console.log(`🗑️  ${keys.length} arquivos deletados para canal ${channelId}`);
}

/**
 * Encontrar VODs órfãos no R2 (sem registro no banco)
 */
async function findOrphanedVODsInR2(client: AwsClient, endpoint: string, supabase: any): Promise<string[]> {
  const orphanedKeys: string[] = [];

  // Listar todos os VODs no R2
  const listResponse = await client.fetch(`${endpoint}?prefix=vod/&list-type=2`, {
    method: 'GET',
  });

  if (!listResponse.ok) {
    console.error(`Erro ao listar VODs: ${listResponse.status}`);
    return orphanedKeys;
  }

  const xml = await listResponse.text();
  const keyMatches = xml.matchAll(/<Key>([^<]+)<\/Key>/g);
  const allKeys: string[] = [];
  
  for (const match of keyMatches) {
    allKeys.push(match[1]);
  }

  if (allKeys.length === 0) {
    return orphanedKeys;
  }

  // Extrair channel_ids únicos
  const channelIds = new Set<string>();
  for (const key of allKeys) {
    const match = key.match(/vod\/([^\/]+)\//);
    if (match) {
      channelIds.add(match[1]);
    }
  }

  // Verificar quais channel_ids não existem mais no banco
  for (const channelId of channelIds) {
    const { data: exists } = await supabase
      .from('m3u_channels')
      .select('id')
      .eq('id', channelId)
      .single();

    if (!exists) {
      // Adicionar todos os arquivos deste canal órfão
      for (const key of allKeys) {
        if (key.startsWith(`vod/${channelId}/`)) {
          orphanedKeys.push(key);
        }
      }
    }
  }

  return orphanedKeys;
}
