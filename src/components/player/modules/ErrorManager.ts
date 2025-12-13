/**
 * ErrorManager - Gerenciamento de erros do player
 * 
 * Responsabilidades:
 * - Capturar 401 / 403 / timeout
 * - Classificar erro
 * - Reagir corretamente
 * - Evitar loop infinito
 */

export type ErrorType = 
  | 'AUTH_EXPIRED'
  | 'AUTH_FORBIDDEN'
  | 'NETWORK_ERROR'
  | 'MANIFEST_ERROR'
  | 'MEDIA_ERROR'
  | 'TIMEOUT'
  | 'FATAL'
  | 'UNKNOWN'

export type ErrorSeverity = 'recoverable' | 'critical' | 'fatal'

export interface PlayerError {
  type: ErrorType
  severity: ErrorSeverity
  message: string
  originalError?: unknown
  httpStatus?: number
  retryCount: number
  timestamp: number
}

export interface ErrorHandlerCallbacks {
  onRecoverable?: (error: PlayerError) => void
  onCritical?: (error: PlayerError) => void
  onFatal?: (error: PlayerError) => void
  onRetry?: (attempt: number) => void
}

const MAX_RETRIES = 3
const RETRY_DELAYS = [1000, 2000, 4000] // Exponential backoff

export class ErrorManager {
  private retryCount = 0
  private lastErrorTime = 0
  private errorHistory: PlayerError[] = []
  private callbacks: ErrorHandlerCallbacks = {}

  constructor(callbacks: ErrorHandlerCallbacks = {}) {
    this.callbacks = callbacks
  }

  /**
   * Handle an error and determine appropriate action
   */
  handle(error: unknown, httpStatus?: number): PlayerError {
    const playerError = this.classify(error, httpStatus)
    this.errorHistory.push(playerError)
    
    // Prevent rapid-fire errors (debounce)
    const now = Date.now()
    if (now - this.lastErrorTime < 500) {
      console.log('[ErrorManager] Debouncing rapid error')
      return playerError
    }
    this.lastErrorTime = now

    console.log('[ErrorManager] Handling error:', playerError.type, playerError.severity)

    switch (playerError.severity) {
      case 'recoverable':
        this.callbacks.onRecoverable?.(playerError)
        break
      case 'critical':
        this.callbacks.onCritical?.(playerError)
        break
      case 'fatal':
        this.callbacks.onFatal?.(playerError)
        break
    }

    return playerError
  }

  /**
   * Check if we should retry
   */
  shouldRetry(): boolean {
    return this.retryCount < MAX_RETRIES
  }

  /**
   * Get delay for next retry (exponential backoff)
   */
  getRetryDelay(): number {
    return RETRY_DELAYS[Math.min(this.retryCount, RETRY_DELAYS.length - 1)]
  }

  /**
   * Increment retry counter
   */
  incrementRetry(): number {
    this.retryCount++
    this.callbacks.onRetry?.(this.retryCount)
    return this.retryCount
  }

  /**
   * Reset retry counter
   */
  resetRetries(): void {
    this.retryCount = 0
  }

  /**
   * Get current retry count
   */
  getRetryCount(): number {
    return this.retryCount
  }

  /**
   * Get error history
   */
  getHistory(): PlayerError[] {
    return [...this.errorHistory]
  }

  /**
   * Clear error history
   */
  clearHistory(): void {
    this.errorHistory = []
    this.retryCount = 0
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(error: PlayerError): string {
    switch (error.type) {
      case 'AUTH_EXPIRED':
        return 'Sessão expirada. Reconectando...'
      case 'AUTH_FORBIDDEN':
        return 'Acesso negado. Verificando permissões...'
      case 'NETWORK_ERROR':
        return 'Conexão instável. Tentando reconectar...'
      case 'MANIFEST_ERROR':
        return 'Erro ao carregar stream. Tentando novamente...'
      case 'MEDIA_ERROR':
        return 'Erro de reprodução. Recuperando...'
      case 'TIMEOUT':
        return 'Tempo limite excedido. Reconectando...'
      case 'FATAL':
        return 'Erro crítico. Por favor, recarregue a página.'
      default:
        return 'Erro inesperado. Tentando recuperar...'
    }
  }

  private classify(error: unknown, httpStatus?: number): PlayerError {
    const timestamp = Date.now()
    const retryCount = this.retryCount

    // HTTP status classification
    if (httpStatus) {
      if (httpStatus === 401) {
        return {
          type: 'AUTH_EXPIRED',
          severity: 'recoverable',
          message: 'Authentication expired',
          httpStatus,
          retryCount,
          timestamp,
          originalError: error
        }
      }
      
      if (httpStatus === 403) {
        return {
          type: 'AUTH_FORBIDDEN',
          severity: 'recoverable',
          message: 'Access forbidden',
          httpStatus,
          retryCount,
          timestamp,
          originalError: error
        }
      }
      
      if (httpStatus >= 500) {
        return {
          type: 'NETWORK_ERROR',
          severity: 'recoverable',
          message: 'Server error',
          httpStatus,
          retryCount,
          timestamp,
          originalError: error
        }
      }
    }

    // Error type classification
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      
      if (message.includes('timeout') || message.includes('aborted')) {
        return {
          type: 'TIMEOUT',
          severity: 'recoverable',
          message: error.message,
          retryCount,
          timestamp,
          originalError: error
        }
      }
      
      if (message.includes('network') || message.includes('fetch')) {
        return {
          type: 'NETWORK_ERROR',
          severity: 'recoverable',
          message: error.message,
          retryCount,
          timestamp,
          originalError: error
        }
      }
      
      if (message.includes('manifest') || message.includes('parsing')) {
        return {
          type: 'MANIFEST_ERROR',
          severity: this.retryCount >= MAX_RETRIES ? 'fatal' : 'critical',
          message: error.message,
          retryCount,
          timestamp,
          originalError: error
        }
      }
      
      if (message.includes('media') || message.includes('decode')) {
        return {
          type: 'MEDIA_ERROR',
          severity: 'recoverable',
          message: error.message,
          retryCount,
          timestamp,
          originalError: error
        }
      }
    }

    // Check if we've exceeded retries
    if (this.retryCount >= MAX_RETRIES) {
      return {
        type: 'FATAL',
        severity: 'fatal',
        message: 'Max retries exceeded',
        retryCount,
        timestamp,
        originalError: error
      }
    }

    return {
      type: 'UNKNOWN',
      severity: 'recoverable',
      message: String(error),
      retryCount,
      timestamp,
      originalError: error
    }
  }
}
