/**
 * Test Contacts Service
 * CRUD operations for test contacts stored in database
 */

import { supabase } from '@/lib/supabase';

export interface TestContact {
  id: string;
  name: string;
  phone: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTestContactInput {
  name: string;
  phone: string;
  notes?: string;
}

export interface UpdateTestContactInput {
  id: string;
  name?: string;
  phone?: string;
  notes?: string;
}

class TestContactsService {
  async getAll(): Promise<TestContact[]> {
    const { data, error } = await supabase
      .from('test_contacts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar contatos de teste:', error);
      return [];
    }

    return data || [];
  }

  async getById(id: string): Promise<TestContact | null> {
    const { data, error } = await supabase
      .from('test_contacts')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar contato de teste:', error);
      return null;
    }

    return data;
  }

  async create(input: CreateTestContactInput): Promise<TestContact | null> {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('test_contacts')
      .insert({
        name: input.name,
        phone: input.phone,
        notes: input.notes || null,
        created_by: user?.id || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar contato de teste:', error);
      throw error;
    }

    return data;
  }

  async update(input: UpdateTestContactInput): Promise<TestContact | null> {
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.notes !== undefined) updateData.notes = input.notes;

    const { data, error } = await supabase
      .from('test_contacts')
      .update(updateData)
      .eq('id', input.id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar contato de teste:', error);
      throw error;
    }

    return data;
  }

  async delete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('test_contacts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar contato de teste:', error);
      throw error;
    }

    return true;
  }
}

export const testContactsService = new TestContactsService();
