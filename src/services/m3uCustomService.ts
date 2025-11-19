import { supabase } from '@/integrations/supabase/client';
import { fetchM3U, parseM3U } from '@/utils/m3uParser';

export interface CustomList {
  id: string;
  name: string;
  description?: string;
  slug: string;
  cdn_url?: string;
  bucket_path?: string;
  total_channels: number;
  total_categories: number;
  status: 'draft' | 'active' | 'inactive';
  last_generated_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CustomCategory {
  id: string;
  custom_list_id: string;
  name: string;
  display_name: string;
  order_position: number;
  icon?: string;
}

export interface CustomChannel {
  id: string;
  category_id: string;
  name: string;
  tvg_id?: string;
  tvg_name?: string;
  tvg_logo?: string;
  group_title?: string;
  stream_url: string;
  order_position: number;
  metadata?: any;
}

export class M3UCustomService {
  /**
   * Cria nova lista personalizada
   */
  async createList(data: {
    name: string;
    description?: string;
    slug: string;
  }): Promise<CustomList> {
    const { data: list, error } = await supabase
      .from('m3u_custom_lists')
      .insert({
        name: data.name,
        description: data.description,
        slug: data.slug,
        status: 'draft',
        created_by: (await supabase.auth.getUser()).data.user?.id
      })
      .select()
      .single();

    if (error) throw new Error(`Erro ao criar lista: ${error.message}`);
    return list as CustomList;
  }

  /**
   * Busca todas as listas
   */
  async getAllLists(): Promise<CustomList[]> {
    const { data, error } = await supabase
      .from('m3u_custom_lists')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Erro ao buscar listas: ${error.message}`);
    return (data || []) as CustomList[];
  }

  /**
   * Busca lista por ID
   */
  async getListById(listId: string): Promise<CustomList | null> {
    const { data, error } = await supabase
      .from('m3u_custom_lists')
      .select('*')
      .eq('id', listId)
      .single();

    if (error) {
      console.error('Erro ao buscar lista:', error);
      return null;
    }
    return data as CustomList;
  }

  /**
   * Atualiza lista
   */
  async updateList(listId: string, updates: Partial<CustomList>): Promise<void> {
    const { error } = await supabase
      .from('m3u_custom_lists')
      .update(updates)
      .eq('id', listId);

    if (error) throw new Error(`Erro ao atualizar lista: ${error.message}`);
  }

  /**
   * Deleta lista
   */
  async deleteList(listId: string): Promise<void> {
    const { error } = await supabase
      .from('m3u_custom_lists')
      .delete()
      .eq('id', listId);

    if (error) throw new Error(`Erro ao deletar lista: ${error.message}`);
  }

  /**
   * Adiciona categoria à lista
   */
  async addCategory(data: {
    custom_list_id: string;
    name: string;
    display_name: string;
    order_position?: number;
    icon?: string;
  }): Promise<CustomCategory> {
    const { data: category, error } = await supabase
      .from('m3u_categories')
      .insert(data)
      .select()
      .single();

    if (error) throw new Error(`Erro ao adicionar categoria: ${error.message}`);
    return category as CustomCategory;
  }

  /**
   * Busca categorias de uma lista
   */
  async getCategories(listId: string): Promise<CustomCategory[]> {
    const { data, error } = await supabase
      .from('m3u_categories')
      .select('*')
      .eq('custom_list_id', listId)
      .order('order_position', { ascending: true });

    if (error) throw new Error(`Erro ao buscar categorias: ${error.message}`);
    return (data || []) as CustomCategory[];
  }

  /**
   * Atualiza categoria
   */
  async updateCategory(categoryId: string, updates: Partial<CustomCategory>): Promise<void> {
    const { error } = await supabase
      .from('m3u_categories')
      .update(updates)
      .eq('id', categoryId);

    if (error) throw new Error(`Erro ao atualizar categoria: ${error.message}`);
  }

  /**
   * Deleta categoria
   */
  async deleteCategory(categoryId: string): Promise<void> {
    const { error } = await supabase
      .from('m3u_categories')
      .delete()
      .eq('id', categoryId);

    if (error) throw new Error(`Erro ao deletar categoria: ${error.message}`);
  }

  /**
   * Adiciona canal à categoria
   */
  async addChannel(data: {
    category_id: string;
    name: string;
    stream_url: string;
    tvg_id?: string;
    tvg_name?: string;
    tvg_logo?: string;
    group_title?: string;
    order_position?: number;
    metadata?: any;
  }): Promise<CustomChannel> {
    const { data: channel, error } = await supabase
      .from('m3u_channels')
      .insert(data)
      .select()
      .single();

    if (error) throw new Error(`Erro ao adicionar canal: ${error.message}`);
    return channel as CustomChannel;
  }

  /**
   * Busca canais de uma categoria
   */
  async getChannels(categoryId: string): Promise<CustomChannel[]> {
    const { data, error } = await supabase
      .from('m3u_channels')
      .select('*')
      .eq('category_id', categoryId)
      .order('order_position', { ascending: true });

    if (error) throw new Error(`Erro ao buscar canais: ${error.message}`);
    return (data || []) as CustomChannel[];
  }

  /**
   * Atualiza canal
   */
  async updateChannel(channelId: string, updates: Partial<CustomChannel>): Promise<void> {
    const { error } = await supabase
      .from('m3u_channels')
      .update(updates)
      .eq('id', channelId);

    if (error) throw new Error(`Erro ao atualizar canal: ${error.message}`);
  }

  /**
   * Deleta canal
   */
  async deleteChannel(channelId: string): Promise<void> {
    const { error } = await supabase
      .from('m3u_channels')
      .delete()
      .eq('id', channelId);

    if (error) throw new Error(`Erro ao deletar canal: ${error.message}`);
  }

  /**
   * Importa M3U de URL (usa Edge Function para evitar Mixed Content)
   */
  async importFromUrl(url: string, listId: string): Promise<{
    categoriesCount: number;
    channelsCount: number;
  }> {
    try {
      const playlist = await fetchM3U(url);
      return this.importParsedPlaylist(playlist, listId);
    } catch (error) {
      throw new Error(`Erro ao importar M3U: ${error}`);
    }
  }

  /**
   * Importa M3U a partir do conteúdo bruto (cola do arquivo)
   */
  async importFromContent(content: string, listId: string): Promise<{
    categoriesCount: number;
    channelsCount: number;
  }> {
    try {
      const playlist = parseM3U(content);
      return this.importParsedPlaylist(playlist, listId);
    } catch (error) {
      throw new Error(`Erro ao importar M3U: ${error}`);
    }
  }

  /**
   * Reutiliza lógica de criação de categorias/canais para uma playlist já parseada
   */
  private async importParsedPlaylist(
    playlist: { channels: any[]; categories: string[] },
    listId: string
  ): Promise<{ categoriesCount: number; channelsCount: number }> {
    let categoriesCount = 0;
    let channelsCount = 0;

    // Criar categorias e canais
    for (const categoryName of playlist.categories) {
      const category = await this.addCategory({
        custom_list_id: listId,
        name: categoryName,
        display_name: categoryName,
        order_position: categoriesCount,
      });

      const channelsInCategory = playlist.channels.filter(
        (ch) => ch.category === categoryName
      );

      for (let i = 0; i < channelsInCategory.length; i++) {
        const ch = channelsInCategory[i];
        await this.addChannel({
          category_id: category.id,
          name: ch.name,
          stream_url: ch.url,
          tvg_id: ch.tvgId,
          tvg_name: ch.tvgName,
          tvg_logo: ch.logo,
          group_title: ch.groupTitle,
          order_position: i,
        });
        channelsCount++;
      }

      categoriesCount++;
    }

    return { categoriesCount, channelsCount };
  }

  /**
   * Duplica lista completa
   */
  async duplicateList(listId: string, newName: string): Promise<CustomList> {
    const originalList = await this.getListById(listId);
    if (!originalList) throw new Error('Lista original não encontrada');

    // Criar nova lista
    const newList = await this.createList({
      name: newName,
      description: originalList.description,
      slug: `${originalList.slug}-copy-${Date.now()}`
    });

    // Copiar categorias
    const categories = await this.getCategories(listId);
    for (const cat of categories) {
      const newCategory = await this.addCategory({
        custom_list_id: newList.id,
        name: cat.name,
        display_name: cat.display_name,
        order_position: cat.order_position,
        icon: cat.icon
      });

      // Copiar canais
      const channels = await this.getChannels(cat.id);
      for (const ch of channels) {
        await this.addChannel({
          category_id: newCategory.id,
          name: ch.name,
          stream_url: ch.stream_url,
          tvg_id: ch.tvg_id,
          tvg_name: ch.tvg_name,
          tvg_logo: ch.tvg_logo,
          group_title: ch.group_title,
          order_position: ch.order_position,
          metadata: ch.metadata
        });
      }
    }

    return newList;
  }

  /**
   * Busca logs de geração
   */
  async getGenerationLogs(listId: string, limit: number = 50) {
    const { data, error } = await supabase
      .from('m3u_generation_logs')
      .select('*')
      .eq('custom_list_id', listId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Erro ao buscar logs: ${error.message}`);
    return data || [];
  }

  /**
   * Registra log de geração
   */
  async logGeneration(data: {
    custom_list_id: string;
    file_size?: number;
    channels_count: number;
    generation_time_ms: number;
    cdn_upload_status: 'success' | 'failed';
    cdn_upload_time_ms?: number;
    error_message?: string;
  }) {
    const { error } = await supabase
      .from('m3u_generation_logs')
      .insert(data);

    if (error) console.error('Erro ao registrar log:', error);
  }
}

export const m3uCustomService = new M3UCustomService();
