import { Cliente } from '@/types/cliente';
import { detectPayment } from './notificationScheduler';

const SNAPSHOT_KEY = 'clients_snapshot';

export class PaymentDetectionService {
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
      if (detectPayment(cliente, this.previousClientsData)) {
        paidClients.push(cliente);
        console.log(`✅ Pagamento detectado: ${cliente.nome}`);
      }
    }

    return paidClients;
  }

  hasPreviousData(): boolean {
    return Object.keys(this.previousClientsData).length > 0;
  }
}
