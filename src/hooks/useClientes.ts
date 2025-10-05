import { useState, useEffect } from 'react';
import { Cliente } from '@/types/cliente';
import clientesData from '@/data/clientes.json';

export const useClientes = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);

  useEffect(() => {
    setClientes(clientesData as Cliente[]);
  }, []);

  const addCliente = (cliente: Omit<Cliente, 'id' | 'dataCadastro' | 'dataUltimaEdicao'>) => {
    const now = new Date().toISOString();
    const novoCliente: Cliente = {
      ...cliente,
      id: crypto.randomUUID(),
      dataCadastro: now,
      dataUltimaEdicao: now,
    };
    setClientes(prev => [...prev, novoCliente]);
    return novoCliente;
  };

  const updateCliente = (id: string, data: Partial<Cliente>) => {
    setClientes(prev =>
      prev.map(c =>
        c.id === id
          ? { ...c, ...data, dataUltimaEdicao: new Date().toISOString() }
          : c
      )
    );
  };

  const deleteCliente = (id: string) => {
    setClientes(prev => prev.filter(c => c.id !== id));
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
      if (!c.periodoValidade || !c.dataVencimento) return false;
      const vencimento = new Date(c.dataVencimento);
      return vencimento >= now && vencimento <= cincoProximos;
    }).length;

    const ativosVencidos = clientes.filter(c => {
      if (c.situacao !== 'Ativo' || !c.periodoValidade || !c.dataVencimento) return false;
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
