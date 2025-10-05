import { useState, useEffect } from 'react';
import { Cliente } from '@/types/cliente';

const STORAGE_KEY = 'clientes_data';

export const useClientes = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setClientes(JSON.parse(stored));
    }
  }, []);

  const addCliente = (cliente: Omit<Cliente, 'id' | 'dataCadastro' | 'dataUltimaEdicao'>) => {
    const now = new Date().toISOString();
    const novoCliente: Cliente = {
      ...cliente,
      id: crypto.randomUUID(),
      dataCadastro: now,
      dataUltimaEdicao: now,
    };
    const novosClientes = [...clientes, novoCliente];
    setClientes(novosClientes);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(novosClientes));
    return novoCliente;
  };

  const updateCliente = (id: string, data: Partial<Cliente>) => {
    const novosClientes = clientes.map(c =>
      c.id === id
        ? { ...c, ...data, dataUltimaEdicao: new Date().toISOString() }
        : c
    );
    setClientes(novosClientes);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(novosClientes));
  };

  const deleteCliente = (id: string) => {
    const novosClientes = clientes.filter(c => c.id !== id);
    setClientes(novosClientes);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(novosClientes));
  };

  const getClienteById = (id: string) => {
    return clientes.find(c => c.id === id);
  };

  const getStats = () => {
    const total = clientes.length;
    const now = new Date();
    const cincoProximos = new Date();
    cincoProximos.setDate(now.getDate() + 5);

    const vencendoProximos5Dias = clientes.filter(c => {
      if (!c.dataVencimento) return false;
      const vencimento = new Date(c.dataVencimento);
      return vencimento >= now && vencimento <= cincoProximos;
    }).length;

    const ativosVencidos = clientes.filter(c => {
      if (c.situacao !== 'Ativo' || !c.dataVencimento) return false;
      const vencimento = new Date(c.dataVencimento);
      return vencimento < now;
    }).length;

    return { total, vencendoProximos5Dias, ativosVencidos };
  };

  return {
    clientes,
    addCliente,
    updateCliente,
    deleteCliente,
    getClienteById,
    getStats,
  };
};
