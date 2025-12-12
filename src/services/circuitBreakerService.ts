/**
 * Circuit Breaker Service
 * 
 * Prevents cascading failures by tracking domain health
 * and temporarily disabling unhealthy endpoints
 */

interface CircuitState {
  failures: number;
  successes: number;
  lastFailure: number;
  lastSuccess: number;
  state: 'closed' | 'open' | 'half-open';
  lastStateChange: number;
}

interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  halfOpenTimeout: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 60000, // 1 minute
  halfOpenTimeout: 30000, // 30 seconds
};

class CircuitBreakerService {
  private circuits = new Map<string, CircuitState>();
  private config: CircuitBreakerConfig;
  private listeners = new Set<(domain: string, state: CircuitState) => void>();

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Load persisted state from localStorage
    this.loadState();
    
    // Periodically save state
    setInterval(() => this.saveState(), 10000);
  }

  private loadState(): void {
    try {
      const saved = localStorage.getItem('circuit-breaker-state');
      if (saved) {
        const parsed = JSON.parse(saved);
        for (const [domain, state] of Object.entries(parsed)) {
          this.circuits.set(domain, state as CircuitState);
        }
        console.log(`[CircuitBreaker] Loaded ${this.circuits.size} circuit states`);
      }
    } catch (error) {
      console.warn('[CircuitBreaker] Failed to load state:', error);
    }
  }

  private saveState(): void {
    try {
      const state: Record<string, CircuitState> = {};
      for (const [domain, circuit] of this.circuits) {
        state[domain] = circuit;
      }
      localStorage.setItem('circuit-breaker-state', JSON.stringify(state));
    } catch (error) {
      console.warn('[CircuitBreaker] Failed to save state:', error);
    }
  }

  private getCircuit(domain: string): CircuitState {
    if (!this.circuits.has(domain)) {
      this.circuits.set(domain, {
        failures: 0,
        successes: 0,
        lastFailure: 0,
        lastSuccess: 0,
        state: 'closed',
        lastStateChange: Date.now(),
      });
    }
    return this.circuits.get(domain)!;
  }

  private updateState(domain: string, circuit: CircuitState): void {
    this.circuits.set(domain, circuit);
    this.notifyListeners(domain, circuit);
  }

  private notifyListeners(domain: string, state: CircuitState): void {
    for (const listener of this.listeners) {
      try {
        listener(domain, state);
      } catch (error) {
        console.error('[CircuitBreaker] Listener error:', error);
      }
    }
  }

  /**
   * Check if a domain is available for requests
   */
  isAvailable(domain: string): boolean {
    const circuit = this.getCircuit(domain);
    const now = Date.now();

    switch (circuit.state) {
      case 'closed':
        return true;
      
      case 'open':
        // Check if timeout has passed to transition to half-open
        if (now - circuit.lastStateChange > this.config.timeout) {
          circuit.state = 'half-open';
          circuit.lastStateChange = now;
          circuit.successes = 0;
          this.updateState(domain, circuit);
          console.log(`[CircuitBreaker] ${domain}: open -> half-open`);
          return true;
        }
        return false;
      
      case 'half-open':
        return true;
      
      default:
        return true;
    }
  }

  /**
   * Record a successful request
   */
  recordSuccess(domain: string): void {
    const circuit = this.getCircuit(domain);
    const now = Date.now();

    circuit.successes++;
    circuit.lastSuccess = now;

    if (circuit.state === 'half-open') {
      if (circuit.successes >= this.config.successThreshold) {
        circuit.state = 'closed';
        circuit.failures = 0;
        circuit.lastStateChange = now;
        console.log(`[CircuitBreaker] ${domain}: half-open -> closed`);
      }
    } else if (circuit.state === 'closed') {
      // Decay failures over time
      if (now - circuit.lastFailure > this.config.timeout) {
        circuit.failures = Math.max(0, circuit.failures - 1);
      }
    }

    this.updateState(domain, circuit);
  }

  /**
   * Record a failed request
   */
  recordFailure(domain: string, error?: string): void {
    const circuit = this.getCircuit(domain);
    const now = Date.now();

    circuit.failures++;
    circuit.lastFailure = now;

    if (circuit.state === 'half-open') {
      // Immediate transition back to open on failure in half-open
      circuit.state = 'open';
      circuit.lastStateChange = now;
      console.log(`[CircuitBreaker] ${domain}: half-open -> open (failure: ${error})`);
    } else if (circuit.state === 'closed') {
      if (circuit.failures >= this.config.failureThreshold) {
        circuit.state = 'open';
        circuit.lastStateChange = now;
        console.log(`[CircuitBreaker] ${domain}: closed -> open (threshold reached: ${error})`);
      }
    }

    this.updateState(domain, circuit);
  }

  /**
   * Get circuit state for a domain
   */
  getState(domain: string): CircuitState {
    return this.getCircuit(domain);
  }

  /**
   * Get all circuit states
   */
  getAllStates(): Map<string, CircuitState> {
    return new Map(this.circuits);
  }

  /**
   * Get health summary
   */
  getHealthSummary(): {
    total: number;
    open: number;
    closed: number;
    halfOpen: number;
    domains: Array<{ domain: string; state: string; failures: number }>;
  } {
    const states = Array.from(this.circuits.entries());
    
    return {
      total: states.length,
      open: states.filter(([_, s]) => s.state === 'open').length,
      closed: states.filter(([_, s]) => s.state === 'closed').length,
      halfOpen: states.filter(([_, s]) => s.state === 'half-open').length,
      domains: states.map(([domain, state]) => ({
        domain,
        state: state.state,
        failures: state.failures,
      })),
    };
  }

  /**
   * Manually reset a circuit
   */
  reset(domain: string): void {
    this.circuits.set(domain, {
      failures: 0,
      successes: 0,
      lastFailure: 0,
      lastSuccess: 0,
      state: 'closed',
      lastStateChange: Date.now(),
    });
    console.log(`[CircuitBreaker] ${domain}: manually reset`);
  }

  /**
   * Reset all circuits
   */
  resetAll(): void {
    for (const domain of this.circuits.keys()) {
      this.reset(domain);
    }
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (domain: string, state: CircuitState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    domain: string,
    fn: () => Promise<T>,
    fallback?: () => T | Promise<T>
  ): Promise<T> {
    if (!this.isAvailable(domain)) {
      console.log(`[CircuitBreaker] ${domain}: circuit open, using fallback`);
      if (fallback) {
        return fallback();
      }
      throw new Error(`Circuit breaker open for ${domain}`);
    }

    try {
      const result = await fn();
      this.recordSuccess(domain);
      return result;
    } catch (error) {
      this.recordFailure(domain, error instanceof Error ? error.message : 'Unknown error');
      
      if (fallback) {
        console.log(`[CircuitBreaker] ${domain}: using fallback after failure`);
        return fallback();
      }
      throw error;
    }
  }
}

// Singleton instance
export const circuitBreaker = new CircuitBreakerService();

// Helper to extract domain from URL
export function getDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
}

// React hook for circuit breaker
export function useCircuitBreaker() {
  return {
    isAvailable: (domain: string) => circuitBreaker.isAvailable(domain),
    recordSuccess: (domain: string) => circuitBreaker.recordSuccess(domain),
    recordFailure: (domain: string, error?: string) => circuitBreaker.recordFailure(domain, error),
    getHealthSummary: () => circuitBreaker.getHealthSummary(),
    reset: (domain: string) => circuitBreaker.reset(domain),
    execute: <T>(domain: string, fn: () => Promise<T>, fallback?: () => T | Promise<T>) => 
      circuitBreaker.execute(domain, fn, fallback),
  };
}
