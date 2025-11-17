import { supabase } from '@/integrations/supabase/client';
import type { AdminShortcut } from '@/types/activity';

export class ShortcutService {
  async getShortcuts(): Promise<AdminShortcut[]> {
    const { data, error } = await supabase
      .from('admin_shortcuts')
      .select('*')
      .order('order_index', { ascending: true });

    if (error) {
      console.error('Erro ao buscar atalhos:', error);
      throw error;
    }

    return data as AdminShortcut[];
  }

  async addShortcut(
    title: string,
    description: string,
    path: string,
    icon: string
  ): Promise<AdminShortcut> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) throw new Error('Usuário não autenticado');

    const { data: existingShortcuts } = await supabase
      .from('admin_shortcuts')
      .select('order_index')
      .eq('user_id', user.id)
      .order('order_index', { ascending: false })
      .limit(1);

    const nextOrder = existingShortcuts && existingShortcuts.length > 0 
      ? existingShortcuts[0].order_index + 1 
      : 0;

    const { data, error } = await supabase
      .from('admin_shortcuts')
      .insert({
        user_id: user.id,
        title,
        description,
        path,
        icon,
        order_index: nextOrder,
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao adicionar atalho:', error);
      throw error;
    }

    return data as AdminShortcut;
  }

  async removeShortcut(id: string): Promise<void> {
    const { error } = await supabase
      .from('admin_shortcuts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao remover atalho:', error);
      throw error;
    }
  }

  async updateShortcutOrder(shortcuts: AdminShortcut[]): Promise<void> {
    const updates = shortcuts.map((shortcut, index) => ({
      id: shortcut.id,
      order_index: index,
    }));

    for (const update of updates) {
      const { error } = await supabase
        .from('admin_shortcuts')
        .update({ order_index: update.order_index })
        .eq('id', update.id);

      if (error) {
        console.error('Erro ao atualizar ordem:', error);
      }
    }
  }
}

export const shortcutService = new ShortcutService();
