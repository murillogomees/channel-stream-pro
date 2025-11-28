/**
 * ============================================================================
 * PlayerStateMachine - State Machine do Player IPTV
 * ============================================================================
 * 
 * Estados:
 * - idle: Player inicializado, sem mídia
 * - loading: Carregando manifesto/stream
 * - buffering: Buffer insuficiente, aguardando dados
 * - playing: Reproduzindo normalmente
 * - paused: Pausado pelo usuário
 * - stalled: Stream travou (network issue)
 * - retrying: Tentando reconectar
 * - error: Erro fatal
 * 
 * @version 1.0.0
 */

// =============================================================================
// TYPES
// =============================================================================

export type PlayerState = 
  | 'idle' 
  | 'loading' 
  | 'buffering' 
  | 'playing' 
  | 'paused' 
  | 'stalled' 
  | 'retrying' 
  | 'error';

export type PlayerEvent = 
  | 'LOAD'
  | 'MANIFEST_LOADED'
  | 'CAN_PLAY'
  | 'PLAY'
  | 'PAUSE'
  | 'WAITING'
  | 'PLAYING'
  | 'STALLED'
  | 'ERROR'
  | 'RETRY'
  | 'RETRY_SUCCESS'
  | 'RETRY_EXHAUSTED'
  | 'RESET';

export interface PlayerContext {
  url: string | null;
  error: string | null;
  retryCount: number;
  maxRetries: number;
  startTime: number | null;
  playbackStartTime: number | null;
  stallCount: number;
  stallDuration: number;
  lastStallStart: number | null;
}

export interface StateTransition {
  from: PlayerState;
  event: PlayerEvent;
  to: PlayerState;
  action?: (context: PlayerContext) => void;
}

type StateListener = (state: PlayerState, context: PlayerContext) => void;

// =============================================================================
// STATE MACHINE
// =============================================================================

export class PlayerStateMachine {
  private state: PlayerState = 'idle';
  private context: PlayerContext;
  private listeners: Set<StateListener> = new Set();
  private transitions: StateTransition[];

  constructor(maxRetries: number = 3) {
    this.context = {
      url: null,
      error: null,
      retryCount: 0,
      maxRetries,
      startTime: null,
      playbackStartTime: null,
      stallCount: 0,
      stallDuration: 0,
      lastStallStart: null,
    };

    // Define all valid transitions
    this.transitions = [
      // From idle
      { from: 'idle', event: 'LOAD', to: 'loading' },
      
      // From loading
      { from: 'loading', event: 'MANIFEST_LOADED', to: 'buffering' },
      { from: 'loading', event: 'CAN_PLAY', to: 'playing' },
      { from: 'loading', event: 'ERROR', to: 'error' },
      { from: 'loading', event: 'RESET', to: 'idle' },
      
      // From buffering
      { from: 'buffering', event: 'CAN_PLAY', to: 'playing' },
      { from: 'buffering', event: 'PLAYING', to: 'playing' },
      { from: 'buffering', event: 'ERROR', to: 'retrying' },
      { from: 'buffering', event: 'STALLED', to: 'stalled' },
      { from: 'buffering', event: 'RESET', to: 'idle' },
      
      // From playing
      { from: 'playing', event: 'PAUSE', to: 'paused' },
      { from: 'playing', event: 'WAITING', to: 'buffering' },
      { from: 'playing', event: 'STALLED', to: 'stalled' },
      { from: 'playing', event: 'ERROR', to: 'retrying' },
      { from: 'playing', event: 'RESET', to: 'idle' },
      
      // From paused
      { from: 'paused', event: 'PLAY', to: 'playing' },
      { from: 'paused', event: 'PLAYING', to: 'playing' },
      { from: 'paused', event: 'RESET', to: 'idle' },
      
      // From stalled
      { from: 'stalled', event: 'PLAYING', to: 'playing' },
      { from: 'stalled', event: 'CAN_PLAY', to: 'playing' },
      { from: 'stalled', event: 'RETRY', to: 'retrying' },
      { from: 'stalled', event: 'ERROR', to: 'retrying' },
      { from: 'stalled', event: 'RESET', to: 'idle' },
      
      // From retrying
      { from: 'retrying', event: 'RETRY_SUCCESS', to: 'loading' },
      { from: 'retrying', event: 'RETRY_EXHAUSTED', to: 'error' },
      { from: 'retrying', event: 'RESET', to: 'idle' },
      
      // From error
      { from: 'error', event: 'RETRY', to: 'loading' },
      { from: 'error', event: 'RESET', to: 'idle' },
      { from: 'error', event: 'LOAD', to: 'loading' },
    ];
  }

  // ---------------------------------------------------------------------------
  // State Management
  // ---------------------------------------------------------------------------

  getState(): PlayerState {
    return this.state;
  }

  getContext(): PlayerContext {
    return { ...this.context };
  }

  send(event: PlayerEvent, payload?: Partial<PlayerContext>): boolean {
    const transition = this.transitions.find(
      t => t.from === this.state && t.event === event
    );

    if (!transition) {
      console.warn(`[StateMachine] Invalid transition: ${this.state} + ${event}`);
      return false;
    }

    const previousState = this.state;
    this.state = transition.to;

    // Update context
    if (payload) {
      Object.assign(this.context, payload);
    }

    // Execute actions based on event
    this.executeEventActions(event, previousState);

    // Execute transition action if defined
    transition.action?.(this.context);

    // Notify listeners
    this.notifyListeners();

    console.log(`[StateMachine] ${previousState} -> ${this.state} (${event})`);
    return true;
  }

  private executeEventActions(event: PlayerEvent, previousState: PlayerState): void {
    switch (event) {
      case 'LOAD':
        this.context.startTime = Date.now();
        this.context.retryCount = 0;
        this.context.error = null;
        break;

      case 'PLAYING':
        if (!this.context.playbackStartTime && this.context.startTime) {
          this.context.playbackStartTime = Date.now();
        }
        // End stall tracking
        if (this.context.lastStallStart) {
          this.context.stallDuration += Date.now() - this.context.lastStallStart;
          this.context.lastStallStart = null;
        }
        break;

      case 'STALLED':
        this.context.stallCount++;
        this.context.lastStallStart = Date.now();
        break;

      case 'RETRY':
        this.context.retryCount++;
        break;

      case 'RETRY_EXHAUSTED':
        this.context.error = `Falha após ${this.context.maxRetries} tentativas`;
        break;

      case 'ERROR':
        if (previousState !== 'retrying') {
          // Auto-retry on first error
          if (this.context.retryCount < this.context.maxRetries) {
            setTimeout(() => this.send('RETRY'), 1000);
          }
        }
        break;

      case 'RESET':
        this.context = {
          ...this.context,
          url: null,
          error: null,
          retryCount: 0,
          startTime: null,
          playbackStartTime: null,
          stallCount: 0,
          stallDuration: 0,
          lastStallStart: null,
        };
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Listeners
  // ---------------------------------------------------------------------------

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.state, this.getContext()));
  }

  // ---------------------------------------------------------------------------
  // QoS Metrics
  // ---------------------------------------------------------------------------

  getQoSMetrics() {
    const now = Date.now();
    const startupTime = this.context.playbackStartTime && this.context.startTime
      ? this.context.playbackStartTime - this.context.startTime
      : null;

    const currentStallDuration = this.context.lastStallStart
      ? now - this.context.lastStallStart
      : 0;

    return {
      state: this.state,
      startupTimeMs: startupTime,
      stallCount: this.context.stallCount,
      totalStallDurationMs: this.context.stallDuration + currentStallDuration,
      retryCount: this.context.retryCount,
      isHealthy: this.state === 'playing' && this.context.stallCount < 3,
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  canRetry(): boolean {
    return this.context.retryCount < this.context.maxRetries;
  }

  isPlaying(): boolean {
    return this.state === 'playing';
  }

  isLoading(): boolean {
    return this.state === 'loading' || this.state === 'buffering';
  }

  hasError(): boolean {
    return this.state === 'error';
  }

  reset(): void {
    this.send('RESET');
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

export const createPlayerStateMachine = (maxRetries?: number) => 
  new PlayerStateMachine(maxRetries);

export default PlayerStateMachine;
