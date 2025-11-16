import { Cliente } from '@/types/cliente';

const SNAPSHOT_KEY = 'clientes_snapshot';

export class NewClientDetector {
  detectNewClients(currentClientes: Cliente[]): Cliente[] {
    const previousData = localStorage.getItem(SNAPSHOT_KEY);
    
    if (!previousData) {
      // Primeira execução - salvar snapshot atual
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(currentClientes));
      return [];
    }

    const previousClientes: Cliente[] = JSON.parse(previousData);
    const previousIds = new Set(previousClientes.map(c => c.id));
    
    // Identificar clientes novos (IDs que não existiam antes)
    const newClientes = currentClientes.filter(c => !previousIds.has(c.id));
    
    // Atualizar snapshot
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(currentClientes));
    
    return newClientes;
  }
}
