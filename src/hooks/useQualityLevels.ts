/**
 * useQualityLevels - Hook to extract quality levels from HLS.js instance
 */

import { useState, useEffect, useCallback } from 'react';

interface QualityLevel {
  index: number;
  height: number;
  width: number;
  bitrate: number;
  label: string;
}

const getQualityLabel = (height: number): string => {
  if (height >= 2160) return '4K';
  if (height >= 1440) return '1440p';
  if (height >= 1080) return '1080p';
  if (height >= 720) return '720p';
  if (height >= 480) return '480p';
  if (height >= 360) return '360p';
  return `${height}p`;
};

export function useQualityLevels(hls: any) {
  const [levels, setLevels] = useState<QualityLevel[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [autoLevel, setAutoLevel] = useState(true);

  useEffect(() => {
    if (!hls) return;

    const updateLevels = () => {
      if (hls.levels && hls.levels.length > 0) {
        const qualityLevels: QualityLevel[] = hls.levels.map((level: any, index: number) => ({
          index,
          height: level.height || 0,
          width: level.width || 0,
          bitrate: level.bitrate || 0,
          label: getQualityLabel(level.height || 0),
        }));
        setLevels(qualityLevels);
      }
    };

    const updateCurrentLevel = (_: any, data: any) => {
      setCurrentLevel(data.level);
    };

    const handleAutoLevelChange = () => {
      setAutoLevel(hls.autoLevelEnabled !== false && hls.currentLevel === -1);
    };

    // Listen for level changes
    hls.on('hlsManifestParsed', updateLevels);
    hls.on('hlsLevelSwitched', updateCurrentLevel);
    hls.on('hlsLevelSwitching', handleAutoLevelChange);

    // Initial state
    updateLevels();
    setCurrentLevel(hls.currentLevel);
    setAutoLevel(hls.autoLevelEnabled !== false);

    return () => {
      hls.off('hlsManifestParsed', updateLevels);
      hls.off('hlsLevelSwitched', updateCurrentLevel);
      hls.off('hlsLevelSwitching', handleAutoLevelChange);
    };
  }, [hls]);

  const setLevel = useCallback((level: number) => {
    if (!hls) return;
    
    if (level === -1) {
      // Enable auto
      hls.currentLevel = -1;
      hls.nextLevel = -1;
      setAutoLevel(true);
    } else {
      // Set specific level
      hls.currentLevel = level;
      hls.nextLevel = level;
      setAutoLevel(false);
    }
    setCurrentLevel(level);
  }, [hls]);

  return {
    levels,
    currentLevel,
    autoLevel,
    setLevel,
  };
}

export type { QualityLevel };
