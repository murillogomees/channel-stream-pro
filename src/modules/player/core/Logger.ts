/**
 * ============================================================================
 * Logger - Corporate-Grade Logging System
 * ============================================================================
 * 
 * Enterprise logging with:
 * - Log levels (DEBUG, INFO, WARN, ERROR, FATAL)
 * - Structured JSON output
 * - Remote log shipping (optional)
 * - Performance tracking
 * - Context enrichment
 * 
 * @version 1.0.0
 */

// =============================================================================
// TYPES
// =============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  data?: Record<string, unknown>;
  context?: LogContext;
}

export interface LogContext {
  sessionId?: string;
  deviceId?: string;
  channelId?: string;
  platform?: string;
  version?: string;
}

export interface LoggerConfig {
  minLevel: LogLevel;
  enableConsole: boolean;
  enableRemote: boolean;
  remoteEndpoint?: string;
  batchSize: number;
  flushIntervalMs: number;
}

// =============================================================================
// LOG LEVEL PRIORITY
// =============================================================================

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

// =============================================================================
// LOGGER CLASS
// =============================================================================

class Logger {
  private config: LoggerConfig;
  private context: LogContext = {};
  private buffer: LogEntry[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      minLevel: 'info',
      enableConsole: true,
      enableRemote: false,
      batchSize: 50,
      flushIntervalMs: 30000,
      ...config,
    };

    // Start flush timer if remote logging enabled
    if (this.config.enableRemote && this.config.remoteEndpoint) {
      this.startFlushTimer();
    }
  }

  // ===========================================================================
  // CONTEXT MANAGEMENT
  // ===========================================================================

  setContext(context: Partial<LogContext>): void {
    this.context = { ...this.context, ...context };
  }

  clearContext(): void {
    this.context = {};
  }

  // ===========================================================================
  // LOGGING METHODS
  // ===========================================================================

  debug(module: string, message: string, data?: Record<string, unknown>): void {
    this.log('debug', module, message, data);
  }

  info(module: string, message: string, data?: Record<string, unknown>): void {
    this.log('info', module, message, data);
  }

  warn(module: string, message: string, data?: Record<string, unknown>): void {
    this.log('warn', module, message, data);
  }

  error(module: string, message: string, data?: Record<string, unknown>): void {
    this.log('error', module, message, data);
  }

  fatal(module: string, message: string, data?: Record<string, unknown>): void {
    this.log('fatal', module, message, data);
    // Fatal logs flush immediately
    this.flush();
  }

  // ===========================================================================
  // PERFORMANCE TRACKING
  // ===========================================================================

  time(module: string, label: string): () => void {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.debug(module, `${label} completed`, { durationMs: Math.round(duration) });
    };
  }

  // ===========================================================================
  // CORE LOGGING
  // ===========================================================================

  private log(
    level: LogLevel,
    module: string,
    message: string,
    data?: Record<string, unknown>
  ): void {
    // Check if level is enabled
    if (LOG_LEVELS[level] < LOG_LEVELS[this.config.minLevel]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
      data,
      context: Object.keys(this.context).length > 0 ? { ...this.context } : undefined,
    };

    // Console output
    if (this.config.enableConsole) {
      this.logToConsole(entry);
    }

    // Buffer for remote
    if (this.config.enableRemote) {
      this.buffer.push(entry);
      
      if (this.buffer.length >= this.config.batchSize) {
        this.flush();
      }
    }
  }

  private logToConsole(entry: LogEntry): void {
    const prefix = `[${entry.module}]`;
    const timestamp = entry.timestamp.split('T')[1].slice(0, 8);
    
    const styles: Record<LogLevel, string> = {
      debug: 'color: #888',
      info: 'color: #2196F3',
      warn: 'color: #FF9800',
      error: 'color: #F44336',
      fatal: 'color: #fff; background: #F44336; padding: 2px 6px; border-radius: 2px',
    };

    const consoleMethod = entry.level === 'fatal' || entry.level === 'error' 
      ? console.error 
      : entry.level === 'warn' 
        ? console.warn 
        : console.log;

    if (entry.data) {
      consoleMethod(
        `%c${timestamp} ${prefix} ${entry.message}`,
        styles[entry.level],
        entry.data
      );
    } else {
      consoleMethod(
        `%c${timestamp} ${prefix} ${entry.message}`,
        styles[entry.level]
      );
    }
  }

  // ===========================================================================
  // REMOTE SHIPPING
  // ===========================================================================

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushIntervalMs);
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0 || !this.config.remoteEndpoint) {
      return;
    }

    const entries = [...this.buffer];
    this.buffer = [];

    try {
      await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs: entries }),
      });
    } catch (error) {
      // Re-add to buffer on failure (up to limit)
      if (this.buffer.length < this.config.batchSize * 2) {
        this.buffer.unshift(...entries);
      }
      console.error('[Logger] Failed to ship logs:', error);
    }
  }

  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const logger = new Logger({
  minLevel: import.meta.env.DEV ? 'debug' : 'info',
  enableConsole: true,
  enableRemote: false,
});

export default Logger;
