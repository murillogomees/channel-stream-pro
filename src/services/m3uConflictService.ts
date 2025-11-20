import { supabase } from '@/integrations/supabase/client';

export interface ImportChange {
  id: string;
  session_id: string;
  custom_list_id: string;
  change_type: 'added' | 'removed' | 'modified';
  entity_type: 'category' | 'channel';
  entity_id?: string;
  entity_name: string;
  old_data?: any;
  new_data?: any;
  created_at: string;
}

export interface ConflictDetectionResult {
  hasConflicts: boolean;
  changes: ImportChange[];
  addedCount: number;
  removedCount: number;
  modifiedCount: number;
}

class M3UConflictService {
  /**
   * Detecta conflitos comparando conteúdo novo com conteúdo existente
   */
  async detectConflicts(
    customListId: string,
    newCategories: any[],
    newChannels: any[]
  ): Promise<ConflictDetectionResult> {
    try {
      // Buscar categorias e canais existentes
      const { data: existingCategories } = await supabase
        .from('m3u_categories')
        .select('*')
        .eq('custom_list_id', customListId);

      const { data: existingChannels } = await supabase
        .from('m3u_channels')
        .select('*')
        .in('category_id', (existingCategories || []).map(c => c.id));

      const changes: ImportChange[] = [];

      // Detectar categorias adicionadas
      const existingCategoryNames = new Set(
        (existingCategories || []).map(c => c.name.toLowerCase())
      );
      
      for (const newCat of newCategories) {
        if (!existingCategoryNames.has(newCat.name.toLowerCase())) {
          changes.push({
            id: crypto.randomUUID(),
            session_id: '',
            custom_list_id: customListId,
            change_type: 'added',
            entity_type: 'category',
            entity_name: newCat.name,
            new_data: newCat,
            created_at: new Date().toISOString()
          });
        }
      }

      // Detectar categorias removidas
      const newCategoryNames = new Set(newCategories.map(c => c.name.toLowerCase()));
      
      for (const existingCat of existingCategories || []) {
        if (!newCategoryNames.has(existingCat.name.toLowerCase())) {
          changes.push({
            id: crypto.randomUUID(),
            session_id: '',
            custom_list_id: customListId,
            change_type: 'removed',
            entity_type: 'category',
            entity_id: existingCat.id,
            entity_name: existingCat.name,
            old_data: existingCat,
            created_at: new Date().toISOString()
          });
        }
      }

      // Detectar canais adicionados/modificados
      const existingChannelsByUrl = new Map(
        (existingChannels || []).map(c => [c.stream_url, c])
      );

      for (const newChannel of newChannels) {
        const existing = existingChannelsByUrl.get(newChannel.stream_url);
        
        if (!existing) {
          changes.push({
            id: crypto.randomUUID(),
            session_id: '',
            custom_list_id: customListId,
            change_type: 'added',
            entity_type: 'channel',
            entity_name: newChannel.name,
            new_data: newChannel,
            created_at: new Date().toISOString()
          });
        } else if (this.hasChannelChanged(existing, newChannel)) {
          changes.push({
            id: crypto.randomUUID(),
            session_id: '',
            custom_list_id: customListId,
            change_type: 'modified',
            entity_type: 'channel',
            entity_id: existing.id,
            entity_name: newChannel.name,
            old_data: existing,
            new_data: newChannel,
            created_at: new Date().toISOString()
          });
        }
      }

      // Detectar canais removidos
      const newChannelUrls = new Set(newChannels.map(c => c.stream_url));
      
      for (const existingChannel of existingChannels || []) {
        if (!newChannelUrls.has(existingChannel.stream_url)) {
          changes.push({
            id: crypto.randomUUID(),
            session_id: '',
            custom_list_id: customListId,
            change_type: 'removed',
            entity_type: 'channel',
            entity_id: existingChannel.id,
            entity_name: existingChannel.name,
            old_data: existingChannel,
            created_at: new Date().toISOString()
          });
        }
      }

      return {
        hasConflicts: changes.length > 0,
        changes,
        addedCount: changes.filter(c => c.change_type === 'added').length,
        removedCount: changes.filter(c => c.change_type === 'removed').length,
        modifiedCount: changes.filter(c => c.change_type === 'modified').length
      };
    } catch (error) {
      console.error('Error detecting conflicts:', error);
      throw error;
    }
  }

  /**
   * Verifica se um canal foi modificado
   */
  private hasChannelChanged(existing: any, newChannel: any): boolean {
    return (
      existing.name !== newChannel.name ||
      existing.tvg_logo !== newChannel.tvg_logo ||
      existing.tvg_id !== newChannel.tvg_id ||
      existing.group_title !== newChannel.group_title
    );
  }

  /**
   * Salva histórico de mudanças no banco
   */
  async saveChanges(sessionId: string, changes: ImportChange[]): Promise<void> {
    try {
      const { error } = await supabase
        .from('m3u_import_changes')
        .insert(
          changes.map(change => ({
            session_id: sessionId,
            custom_list_id: change.custom_list_id,
            change_type: change.change_type,
            entity_type: change.entity_type,
            entity_id: change.entity_id,
            entity_name: change.entity_name,
            old_data: change.old_data,
            new_data: change.new_data
          }))
        );

      if (error) throw error;
    } catch (error) {
      console.error('Error saving changes:', error);
      throw error;
    }
  }

  /**
   * Busca histórico de mudanças de uma sessão
   */
  async getSessionChanges(sessionId: string): Promise<ImportChange[]> {
    try {
      const { data, error } = await supabase
        .from('m3u_import_changes')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map(item => ({
        ...item,
        change_type: item.change_type as 'added' | 'removed' | 'modified',
        entity_type: item.entity_type as 'category' | 'channel'
      }));
    } catch (error) {
      console.error('Error fetching session changes:', error);
      return [];
    }
  }

  /**
   * Busca histórico de mudanças de uma lista
   */
  async getListChangeHistory(customListId: string, limit = 100): Promise<ImportChange[]> {
    try {
      const { data, error } = await supabase
        .from('m3u_import_changes')
        .select('*')
        .eq('custom_list_id', customListId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []).map(item => ({
        ...item,
        change_type: item.change_type as 'added' | 'removed' | 'modified',
        entity_type: item.entity_type as 'category' | 'channel'
      }));
    } catch (error) {
      console.error('Error fetching list change history:', error);
      return [];
    }
  }

  /**
   * Aplica resolução de conflito (merge ou replace)
   */
  async applyResolution(
    sessionId: string,
    customListId: string,
    mode: 'merge' | 'replace',
    changes: ImportChange[]
  ): Promise<void> {
    try {
      // Atualizar sessão com modo de resolução
      await supabase
        .from('m3u_import_sessions')
        .update({
          conflict_resolution_mode: mode,
          conflicts_detected: changes.length,
          conflicts_resolved: changes.length,
          auto_resolved: false
        })
        .eq('id', sessionId);

      if (mode === 'replace') {
        // Modo substituir: deletar tudo antes de importar
        await this.clearListContent(customListId);
      }
      // Modo merge: mantém conteúdo existente e apenas adiciona/atualiza
    } catch (error) {
      console.error('Error applying conflict resolution:', error);
      throw error;
    }
  }

  /**
   * Remove todo conteúdo de uma lista
   */
  private async clearListContent(customListId: string): Promise<void> {
    // Deletar canais (cascata deletará referências)
    const { data: categories } = await supabase
      .from('m3u_categories')
      .select('id')
      .eq('custom_list_id', customListId);

    if (categories && categories.length > 0) {
      await supabase
        .from('m3u_channels')
        .delete()
        .in('category_id', categories.map(c => c.id));
    }

    // Deletar categorias
    await supabase
      .from('m3u_categories')
      .delete()
      .eq('custom_list_id', customListId);
  }
}

export const m3uConflictService = new M3UConflictService();
