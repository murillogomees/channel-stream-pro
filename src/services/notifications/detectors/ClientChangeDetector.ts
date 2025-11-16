import { Cliente } from '@/types/cliente';

export interface ClientChange {
  cliente: Cliente;
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
}

export class ClientChangeDetector {
  detectChanges(currentCliente: Cliente, previousCliente: Cliente): ClientChange | null {
    const changes: ClientChange['changes'] = [];

    // Verificar mudanças importantes
    if (currentCliente.plano !== previousCliente.plano) {
      changes.push({
        field: 'plano',
        oldValue: previousCliente.plano,
        newValue: currentCliente.plano,
      });
    }

    if (currentCliente.dataVencimento !== previousCliente.dataVencimento) {
      changes.push({
        field: 'dataVencimento',
        oldValue: previousCliente.dataVencimento,
        newValue: currentCliente.dataVencimento,
      });
    }

    if (currentCliente.situacao !== previousCliente.situacao) {
      changes.push({
        field: 'situacao',
        oldValue: previousCliente.situacao,
        newValue: currentCliente.situacao,
      });
    }

    if (currentCliente.valorPago !== previousCliente.valorPago) {
      changes.push({
        field: 'valorPago',
        oldValue: previousCliente.valorPago,
        newValue: currentCliente.valorPago,
      });
    }

    if (changes.length === 0) {
      return null;
    }

    return {
      cliente: currentCliente,
      changes,
    };
  }

  hasSignificantChanges(change: ClientChange | null): boolean {
    if (!change) return false;
    
    // Mudanças significativas são aquelas que merecem notificação
    const significantFields = ['plano', 'dataVencimento', 'situacao', 'valorPago'];
    return change.changes.some(c => significantFields.includes(c.field));
  }
}
