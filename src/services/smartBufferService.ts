export interface BufferConfig {
  minBuffer: number;      // Minimum buffer in seconds
  maxBuffer: number;      // Maximum buffer in seconds
  targetBuffer: number;   // Target buffer level
  rebufferThreshold: number; // When to trigger rebuffering
}

export interface NetworkConditions {
  effectiveType: '4g' | '3g' | '2g' | 'slow-2g' | 'unknown';
  downlink: number;       // Mbps
  rtt: number;            // Round trip time in ms
  saveData: boolean;
}

export interface BufferMetrics {
  currentBuffer: number;
  targetBuffer: number;
  networkSpeed: number;
  isBuffering: boolean;
  bufferHealth: 'excellent' | 'good' | 'fair' | 'poor';
  adjustmentsMade: number;
}

type ContentType = 'live' | 'vod' | 'sports';

class SmartBufferService {
  private currentConfig: BufferConfig;
  private contentType: ContentType = 'live';
  private networkConditions: NetworkConditions;
  private adjustmentCount = 0;
  private lastAdjustment = 0;
  private bufferHistory: number[] = [];

  // Default configs per content type
  private readonly configs: Record<ContentType, BufferConfig> = {
    live: {
      minBuffer: 5,
      maxBuffer: 15,
      targetBuffer: 10,
      rebufferThreshold: 2
    },
    vod: {
      minBuffer: 15,
      maxBuffer: 60,
      targetBuffer: 30,
      rebufferThreshold: 5
    },
    sports: {
      minBuffer: 3,
      maxBuffer: 10,
      targetBuffer: 6,
      rebufferThreshold: 1.5
    }
  };

  constructor() {
    this.currentConfig = { ...this.configs.live };
    this.networkConditions = this.detectNetworkConditions();
    this.startNetworkMonitoring();
  }

  setContentType(type: ContentType): void {
    this.contentType = type;
    this.currentConfig = { ...this.configs[type] };
    this.adaptToNetwork();
    console.log(`[SmartBuffer] Content type set to ${type}`, this.currentConfig);
  }

  private detectNetworkConditions(): NetworkConditions {
    const nav = navigator as any;
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection;

    if (connection) {
      return {
        effectiveType: connection.effectiveType || 'unknown',
        downlink: connection.downlink || 10,
        rtt: connection.rtt || 100,
        saveData: connection.saveData || false
      };
    }

    return {
      effectiveType: 'unknown',
      downlink: 10,
      rtt: 100,
      saveData: false
    };
  }

  private startNetworkMonitoring(): void {
    const nav = navigator as any;
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection;

    if (connection) {
      connection.addEventListener('change', () => {
        this.networkConditions = this.detectNetworkConditions();
        this.adaptToNetwork();
      });
    }

    // Periodic check every 30 seconds
    setInterval(() => {
      this.networkConditions = this.detectNetworkConditions();
    }, 30000);
  }

  private adaptToNetwork(): void {
    const baseConfig = this.configs[this.contentType];
    const now = Date.now();

    // Rate limit adjustments (max once per 5 seconds)
    if (now - this.lastAdjustment < 5000) return;

    const { effectiveType, downlink, saveData } = this.networkConditions;

    // Adjust based on network conditions
    let multiplier = 1;

    switch (effectiveType) {
      case '4g':
        multiplier = 1;
        break;
      case '3g':
        multiplier = 1.5;
        break;
      case '2g':
        multiplier = 2;
        break;
      case 'slow-2g':
        multiplier = 2.5;
        break;
      default:
        // Use downlink to estimate
        if (downlink > 5) multiplier = 1;
        else if (downlink > 2) multiplier = 1.5;
        else multiplier = 2;
    }

    // Save data mode: reduce buffers
    if (saveData) {
      multiplier *= 0.7;
    }

    // Apply adjustments
    this.currentConfig = {
      minBuffer: Math.round(baseConfig.minBuffer * multiplier),
      maxBuffer: Math.round(baseConfig.maxBuffer * multiplier),
      targetBuffer: Math.round(baseConfig.targetBuffer * multiplier),
      rebufferThreshold: baseConfig.rebufferThreshold * multiplier
    };

    // Clamp values
    this.currentConfig.minBuffer = Math.max(2, Math.min(this.currentConfig.minBuffer, 30));
    this.currentConfig.maxBuffer = Math.max(10, Math.min(this.currentConfig.maxBuffer, 120));
    this.currentConfig.targetBuffer = Math.max(5, Math.min(this.currentConfig.targetBuffer, 60));

    this.lastAdjustment = now;
    this.adjustmentCount++;

    console.log(`[SmartBuffer] Adapted to network: ${effectiveType}, downlink: ${downlink}Mbps`, this.currentConfig);
  }

  recordBufferLevel(level: number): void {
    this.bufferHistory.push(level);
    if (this.bufferHistory.length > 30) {
      this.bufferHistory.shift();
    }

    // Check for consistent low buffer - might need to increase
    const avgBuffer = this.bufferHistory.reduce((a, b) => a + b, 0) / this.bufferHistory.length;
    
    if (avgBuffer < this.currentConfig.minBuffer && this.bufferHistory.length >= 10) {
      this.increaseBuffer();
    }
  }

  private increaseBuffer(): void {
    const increment = Math.ceil(this.currentConfig.targetBuffer * 0.2);
    
    this.currentConfig.targetBuffer = Math.min(
      this.currentConfig.targetBuffer + increment,
      this.currentConfig.maxBuffer
    );

    this.currentConfig.minBuffer = Math.min(
      this.currentConfig.minBuffer + Math.ceil(increment / 2),
      this.currentConfig.targetBuffer - 2
    );

    this.adjustmentCount++;
    console.log('[SmartBuffer] Increased buffer due to low levels', this.currentConfig);
  }

  getConfig(): BufferConfig {
    return { ...this.currentConfig };
  }

  getNetworkConditions(): NetworkConditions {
    return { ...this.networkConditions };
  }

  getMetrics(currentBuffer: number): BufferMetrics {
    let bufferHealth: BufferMetrics['bufferHealth'];
    
    if (currentBuffer >= this.currentConfig.targetBuffer) {
      bufferHealth = 'excellent';
    } else if (currentBuffer >= this.currentConfig.minBuffer) {
      bufferHealth = 'good';
    } else if (currentBuffer >= this.currentConfig.rebufferThreshold) {
      bufferHealth = 'fair';
    } else {
      bufferHealth = 'poor';
    }

    return {
      currentBuffer,
      targetBuffer: this.currentConfig.targetBuffer,
      networkSpeed: this.networkConditions.downlink,
      isBuffering: currentBuffer < this.currentConfig.rebufferThreshold,
      bufferHealth,
      adjustmentsMade: this.adjustmentCount
    };
  }

  // Get Shaka Player config
  getShakaConfig(): object {
    return {
      streaming: {
        bufferingGoal: this.currentConfig.targetBuffer,
        rebufferingGoal: this.currentConfig.rebufferThreshold,
        bufferBehind: Math.min(this.currentConfig.maxBuffer, 30),
        stallEnabled: true,
        stallThreshold: 1,
        stallSkip: this.currentConfig.rebufferThreshold
      }
    };
  }

  // Get HLS.js config
  getHlsJsConfig(): object {
    return {
      maxBufferLength: this.currentConfig.maxBuffer,
      maxMaxBufferLength: this.currentConfig.maxBuffer * 2,
      maxBufferSize: 60 * 1000 * 1000, // 60MB
      maxBufferHole: 0.5,
      lowBufferWatchdogPeriod: 0.5,
      highBufferWatchdogPeriod: 3,
      backBufferLength: this.currentConfig.maxBuffer
    };
  }

  reset(): void {
    this.bufferHistory = [];
    this.adjustmentCount = 0;
    this.currentConfig = { ...this.configs[this.contentType] };
    this.adaptToNetwork();
  }
}

export const smartBufferService = new SmartBufferService();
