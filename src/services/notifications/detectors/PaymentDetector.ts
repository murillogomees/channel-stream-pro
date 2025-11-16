import { Cliente } from '@/types/cliente';

const SNAPSHOT_KEY = 'clients_snapshot';

export class PaymentDetector {
  private previousClientsData: Record<string, Cliente> = {};

  loadPreviousData() {
    const stored = localStorage.getItem(SNAPSHOT_KEY);
    if (stored) {
      try {
        this.previousClientsData = JSON.parse(stored);
      } catch (error) {
        console.error('Erro ao carregar snapshot de clientes:', error);
      }
    }
  }

  saveCurrentData(clientes: Cliente[]) {
    const snapshot = clientes.reduce((acc, c) => {
      acc[c.id] = c;
      return acc;
    }, {} as Record<string, Cliente>);
    
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
    this.previousClientsData = snapshot;
  }

  detectPayments(currentClientes: Cliente[]): Cliente[] {
    const paidClients: Cliente[] = [];

    for (const cliente of currentClientes) {
      if (this.detectPayment(cliente)) {
        paidClients.push(cliente);
        console.log(`✅ Pagamento detectado: ${cliente.nome}`);
      }
    }

    return paidClients;
  }

  private detectPayment(currentCliente: Cliente): boolean {
    const previous = this.previousClientsData[currentCliente.id];
    if (!previous) return false;

    // Detectar se houve pagamento baseado nas mudanças
    const paidAmountIncreased = (currentCliente.valorPago || 0) > (previous.valorPago || 0);
    const dueDateChanged = currentCliente.dataVencimento !== previous.dataVencimento;
    const statusImproved = 
      (previous.situacao === 'Devendo' && currentCliente.situacao === 'Ativo') ||
      (previous.situacao === 'Testando' && currentCliente.situacao === 'Ativo');

    return paidAmountIncreased || (dueDateChanged && statusImproved);
  }

  hasPreviousData(): boolean {
    return Object.keys(this.previousClientsData).length > 0;
  }
}
