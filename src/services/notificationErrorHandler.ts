import { Cliente } from '@/types/cliente';

const ERROR_STORAGE_KEY = 'notification_errors';
const MAX_ERRORS = 100;

export interface NotificationError {
  timestamp: string;
  clienteId: string;
  clienteNome: string;
  error: string;
  retryCount: number;
}

export class NotificationErrorHandler {
  private errors: NotificationError[] = [];

  constructor() {
    this.loadErrors();
  }

  private loadErrors() {
    const stored = localStorage.getItem(ERROR_STORAGE_KEY);
    if (stored) {
      try {
        this.errors = JSON.parse(stored);
      } catch (error) {
        console.error('Erro ao carregar erros de notificação:', error);
      }
    }
  }

  private saveErrors() {
    localStorage.setItem(ERROR_STORAGE_KEY, JSON.stringify(this.errors));
  }

  logError(cliente: Cliente, error: Error, retryCount = 0) {
    this.errors.unshift({
      timestamp: new Date().toISOString(),
      clienteId: cliente.id,
      clienteNome: cliente.nome,
      error: error.message,
      retryCount,
    });

    // Limitar a MAX_ERRORS erros
    if (this.errors.length > MAX_ERRORS) {
      this.errors = this.errors.slice(0, MAX_ERRORS);
    }

    this.saveErrors();
  }

  getRecentErrors(limit = 20): NotificationError[] {
    return this.errors.slice(0, limit);
  }

  clearErrors() {
    this.errors = [];
    localStorage.removeItem(ERROR_STORAGE_KEY);
  }

  getErrorCount(): number {
    return this.errors.length;
  }
}
