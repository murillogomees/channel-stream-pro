/**
 * DEPRECATED: Use useProfiles instead
 * Alias temporário para compatibilidade
 */

import { useProfiles } from './useProfiles';
import { Cliente, clienteToDb, dbToCliente } from '@/types/cliente';

export function useClientesDb() {
  const { profiles, loading, error, refresh, updateProfile, deleteProfile, getStats } = useProfiles();

  // Converter profiles para formato Cliente (legacy)
  const clientes: Cliente[] = profiles.map(p => ({
    id: p.id,
    userId: p.id,
    nome: p.nome,
    telefone: p.telefone,
    email: p.email,
    situacao: p.situacao as any || 'Testando',
    dataContratacao: p.data_contratacao || p.created_at,
    dataVencimento: p.data_vencimento || '',
    plano: p.plano as any || 'Mensal',
    valorPago: p.valor_pago || 0,
    dataUltimoPagamento: p.data_ultimo_pagamento,
    formaUltimoPagamento: p.forma_ultimo_pagamento,
    usuarioM3u: '',
    senhaM3u: '',
    dataCadastro: p.created_at,
    dataUltimaEdicao: p.updated_at,
    clienteAtivo: p.cliente_ativo ?? true,
    origemCadastro: p.origem_cadastro as any,
    isRecorrente: p.is_recorrente,
    dispositivoContratado: p.dispositivo_contratado as any,
  }));

  const addCliente = async (data: Partial<Cliente>) => {
    const dbData = clienteToDb(data);
    return updateProfile(data.id!, dbData as any);
  };

  const updateCliente = async (id: string, data: Partial<Cliente>) => {
    const dbData = clienteToDb(data);
    return updateProfile(id, dbData as any);
  };

  return {
    clientes,
    loading,
    error,
    refresh,
    addCliente,
    updateCliente,
    deleteCliente: deleteProfile,
    getStats,
  };
}
