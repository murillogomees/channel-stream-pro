/**
 * useFastStartup - CONSOLIDATED (wrapper for useFastStartupV2)
 * 
 * @deprecated Use useFastStartupV2 directly for new code
 * This wrapper maintains backward compatibility while delegating to V2
 */

import { useMemo, useCallback } from 'react';
import { useFastStartupV2 } from './useFastStartupV2';
import Hls from 'hls.js';

interface CodecSupport {
  h264Baseline: boolean;
  h264Main: boolean;
  h264High: boolean;
  h265: boolean;
  vp9: boolean;
  av1: boolean;
  aacLC: boolean;
  aacHE: boolean;
  mp3: boolean;
  opus: boolean;
}

interface DeviceCapabilities {
  isLowEnd: boolean;
  maxResolution: '480p' | '720p' | '1080p' | '4k';
  supportsHardwareDecoding: boolean;
  memory: number;
  cores: number;
}

interface StartupConfig {
  preferredCodecs: string[];
  maxInitialBitrate: number;
  startLevel: number;
  enableWorker: boolean;
  preferredResolution: '480p' | '720p' | '1080p' | '4k';
}

// Cached detection results
let cachedCodecSupport: CodecSupport | null = null;
let cachedDeviceCapabilities: DeviceCapabilities | null = null;

function detectCodecSupport(): CodecSupport {
  if (cachedCodecSupport) return cachedCodecSupport;
  
  const video = document.createElement('video');
  cachedCodecSupport = {
    h264Baseline: video.canPlayType('video/mp4; codecs="avc1.42E01E"') !== '',
    h264Main: video.canPlayType('video/mp4; codecs="avc1.4D401E"') !== '',
    h264High: video.canPlayType('video/mp4; codecs="avc1.64001E"') !== '',
    h265: video.canPlayType('video/mp4; codecs="hvc1.1.6.L93.B0"') !== '',
    vp9: video.canPlayType('video/webm; codecs="vp9"') !== '',
    av1: video.canPlayType('video/mp4; codecs="av01.0.01M.08"') !== '',
    aacLC: video.canPlayType('audio/mp4; codecs="mp4a.40.2"') !== '',
    aacHE: video.canPlayType('audio/mp4; codecs="mp4a.40.5"') !== '',
    mp3: video.canPlayType('audio/mpeg') !== '',
    opus: video.canPlayType('audio/webm; codecs="opus"') !== '',
  };
  return cachedCodecSupport;
}

function detectDeviceCapabilities(): DeviceCapabilities {
  if (cachedDeviceCapabilities) return cachedDeviceCapabilities;
  
  const cores = navigator.hardwareConcurrency || 4;
  // @ts-ignore
  const memory = navigator.deviceMemory || 4;
  const isLowEnd = cores <= 2 || memory <= 2;
  
  let maxResolution: '480p' | '720p' | '1080p' | '4k' = '1080p';
  if (isLowEnd) maxResolution = '480p';
  else if (cores >= 8 && memory >= 8) maxResolution = '4k';
  else if (cores >= 4 && memory >= 4) maxResolution = '1080p';
  else maxResolution = '720p';

  cachedDeviceCapabilities = {
    isLowEnd,
    maxResolution,
    supportsHardwareDecoding: !isLowEnd,
    memory,
    cores,
  };
  return cachedDeviceCapabilities;
}

/**
 * @deprecated Use useFastStartupV2 directly
 */
export function useFastStartup() {
  const v2 = useFastStartupV2({
    startLowQuality: true,
    upgradeDelay: 2,
    preconnectDomains: [],
  });

  // Get cached capabilities (sync)
  const codecSupport = useMemo(() => detectCodecSupport(), []);
  const deviceCapabilities = useMemo(() => detectDeviceCapabilities(), []);

  const startupConfig = useMemo((): StartupConfig => {
    const preferredCodecs: string[] = [];
    if (codecSupport.av1) preferredCodecs.push('av01');
    if (codecSupport.h265) preferredCodecs.push('hvc1', 'hev1');
    if (codecSupport.vp9) preferredCodecs.push('vp9');
    if (codecSupport.h264High) preferredCodecs.push('avc1.64');
    
    // @ts-ignore
    const connection = navigator.connection;
    let maxInitialBitrate = 2000000;
    if (connection?.downlink) {
      maxInitialBitrate = Math.min(connection.downlink * 1000000 * 0.7, 8000000);
    }
    if (deviceCapabilities.isLowEnd) {
      maxInitialBitrate = Math.min(maxInitialBitrate, 1000000);
    }

    return {
      preferredCodecs,
      maxInitialBitrate,
      startLevel: deviceCapabilities.isLowEnd ? 0 : -1,
      enableWorker: !deviceCapabilities.isLowEnd,
      preferredResolution: deviceCapabilities.maxResolution,
    };
  }, [codecSupport, deviceCapabilities]);

  const getOptimalHlsConfig = useCallback((): Partial<Hls['config']> => {
    // Delegate to V2's optimized config
    return v2.getConfig();
  }, [v2]);

  const preflightCheck = useCallback(async (url: string) => {
    const startTime = performance.now();
    try {
      const response = await fetch(url, { method: 'HEAD', cache: 'no-cache' });
      const latency = performance.now() - startTime;
      const supported = response.ok;
      return {
        supported,
        bestLevel: latency > 2000 ? 0 : latency > 1000 ? 1 : -1,
        estimatedStartTime: Math.max(500, latency * 3),
      };
    } catch {
      return { supported: false, bestLevel: 0, estimatedStartTime: 5000 };
    }
  }, []);

  return {
    codecSupport,
    deviceCapabilities,
    startupConfig,
    isAnalyzing: false,
    getOptimalHlsConfig,
    preflightCheck,
  };
}

export default useFastStartup;
