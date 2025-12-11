/**
 * Hook for managing test contacts
 */

import { useState, useEffect, useCallback } from 'react';
import { testContactsService, TestContact, CreateTestContactInput, UpdateTestContactInput } from '@/services/testContactsService';
import { toast } from 'sonner';

export function useTestContacts() {
  const [contacts, setContacts] = useState<TestContact[]>([]);
  const [loading, setLoading] = useState(true);

  const loadContacts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await testContactsService.getAll();
      setContacts(data);
    } catch (error) {
      console.error('Erro ao carregar contatos:', error);
      toast.error('Erro ao carregar contatos de teste');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const addContact = useCallback(async (input: CreateTestContactInput) => {
    try {
      const newContact = await testContactsService.create(input);
      if (newContact) {
        setContacts(prev => [newContact, ...prev]);
        toast.success('Contato de teste adicionado!');
        return newContact;
      }
    } catch (error) {
      toast.error('Erro ao adicionar contato');
      throw error;
    }
  }, []);

  const updateContact = useCallback(async (input: UpdateTestContactInput) => {
    try {
      const updated = await testContactsService.update(input);
      if (updated) {
        setContacts(prev => prev.map(c => c.id === input.id ? updated : c));
        toast.success('Contato atualizado!');
        return updated;
      }
    } catch (error) {
      toast.error('Erro ao atualizar contato');
      throw error;
    }
  }, []);

  const deleteContact = useCallback(async (id: string) => {
    try {
      await testContactsService.delete(id);
      setContacts(prev => prev.filter(c => c.id !== id));
      toast.success('Contato removido!');
    } catch (error) {
      toast.error('Erro ao remover contato');
      throw error;
    }
  }, []);

  return {
    contacts,
    loading,
    addContact,
    updateContact,
    deleteContact,
    refresh: loadContacts,
  };
}
