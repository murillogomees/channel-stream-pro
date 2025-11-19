import { supabase } from '@/integrations/supabase/client';

interface M3UChannel {
  id: string;
  name: string;
  tvg_id?: string;
  tvg_name?: string;
  tvg_logo?: string;
  group_title?: string;
  stream_url: string;
  order_position: number;
}

interface M3UCategory {
  id: string;
  name: string;
  display_name: string;
  order_position: number;
  channels: M3UChannel[];
}

export class M3UGeneratorService {
  /**
   * Gera conteúdo M3U completo a partir da lista personalizada
   */
  async generateM3U(customListId: string): Promise<string> {
    const startTime = Date.now();

    // Buscar lista personalizada
    const { data: customList, error: listError } = await supabase
      .from('m3u_custom_lists')
      .select('*')
      .eq('id', customListId)
      .single();

    if (listError || !customList) {
      throw new Error(`Lista personalizada não encontrada: ${listError?.message}`);
    }

    // Buscar categorias ordenadas
    const { data: categories, error: categoriesError } = await supabase
      .from('m3u_categories')
      .select('*')
      .eq('custom_list_id', customListId)
      .order('order_position', { ascending: true });

    if (categoriesError) {
      throw new Error(`Erro ao buscar categorias: ${categoriesError.message}`);
    }

    if (!categories || categories.length === 0) {
      throw new Error('Lista não possui categorias configuradas');
    }

    // Buscar canais de todas as categorias
    const categoriesWithChannels: M3UCategory[] = [];
    let totalChannels = 0;

    for (const category of categories) {
      const { data: channels, error: channelsError } = await supabase
        .from('m3u_channels')
        .select('*')
        .eq('category_id', category.id)
        .order('order_position', { ascending: true });

      if (channelsError) {
        console.error(`Erro ao buscar canais da categoria ${category.name}:`, channelsError);
        continue;
      }

      if (channels && channels.length > 0) {
        categoriesWithChannels.push({
          id: category.id,
          name: category.name,
          display_name: category.display_name,
          order_position: category.order_position,
          channels: channels as M3UChannel[]
        });
        totalChannels += channels.length;
      }
    }

    // Gerar conteúdo M3U
    let m3uContent = '#EXTM3U\n\n';

    for (const category of categoriesWithChannels) {
      for (const channel of category.channels) {
        const tvgId = channel.tvg_id ? ` tvg-id="${channel.tvg_id}"` : '';
        const tvgName = channel.tvg_name ? ` tvg-name="${channel.tvg_name}"` : '';
        const tvgLogo = channel.tvg_logo ? ` tvg-logo="${channel.tvg_logo}"` : '';
        const groupTitle = ` group-title="${category.display_name}"`;

        m3uContent += `#EXTINF:-1${tvgId}${tvgName}${tvgLogo}${groupTitle},${channel.name}\n`;
        m3uContent += `${channel.stream_url}\n\n`;
      }
    }

    const generationTime = Date.now() - startTime;

    // Atualizar contadores na lista
    await supabase
      .from('m3u_custom_lists')
      .update({
        total_channels: totalChannels,
        total_categories: categoriesWithChannels.length,
        last_generated_at: new Date().toISOString()
      })
      .eq('id', customListId);

    console.log(`M3U gerada em ${generationTime}ms com ${totalChannels} canais`);

    return m3uContent;
  }

  /**
   * Calcula tamanho estimado do arquivo M3U
   */
  async getEstimatedSize(customListId: string): Promise<number> {
    const { data: channels, error } = await supabase
      .from('m3u_channels')
      .select('id, name, stream_url, tvg_logo')
      .eq('category_id', customListId);

    if (error || !channels) return 0;

    // Estimativa: ~200 bytes por canal
    return channels.length * 200;
  }

  /**
   * Valida URLs de stream de todos os canais
   */
  async validateStreams(customListId: string): Promise<{
    total: number;
    valid: number;
    invalid: number;
    invalidChannels: Array<{ id: string; name: string; url: string }>;
  }> {
    const { data: categories } = await supabase
      .from('m3u_categories')
      .select('id')
      .eq('custom_list_id', customListId);

    if (!categories) {
      return { total: 0, valid: 0, invalid: 0, invalidChannels: [] };
    }

    const categoryIds = categories.map(c => c.id);
    const { data: channels } = await supabase
      .from('m3u_channels')
      .select('id, name, stream_url')
      .in('category_id', categoryIds);

    if (!channels) {
      return { total: 0, valid: 0, invalid: 0, invalidChannels: [] };
    }

    const invalidChannels: Array<{ id: string; name: string; url: string }> = [];
    let validCount = 0;

    for (const channel of channels) {
      try {
        const response = await fetch(channel.stream_url, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000)
        });

        if (response.ok) {
          validCount++;
        } else {
          invalidChannels.push({
            id: channel.id,
            name: channel.name,
            url: channel.stream_url
          });
        }
      } catch (error) {
        invalidChannels.push({
          id: channel.id,
          name: channel.name,
          url: channel.stream_url
        });
      }
    }

    return {
      total: channels.length,
      valid: validCount,
      invalid: invalidChannels.length,
      invalidChannels
    };
  }
}

export const m3uGeneratorService = new M3UGeneratorService();
