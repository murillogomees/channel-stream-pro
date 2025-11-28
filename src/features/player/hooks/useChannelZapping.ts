/**
 * useChannelZapping - Hook for quick channel switching
 * Handles channel up/down, number input, and recent channels
 */

import { useState, useCallback, useEffect, useRef } from 'react';

interface Channel {
  id: string;
  name: string;
  stream_url: string;
  tvg_logo?: string;
  category_name?: string;
  [key: string]: any;
}

interface UseZappingOptions {
  channels: Channel[];
  currentChannel: Channel | null;
  onChannelChange: (channel: Channel) => void;
  maxRecentChannels?: number;
  numberInputTimeout?: number; // ms to wait for more digits
}

export function useChannelZapping(options: UseZappingOptions) {
  const {
    channels,
    currentChannel,
    onChannelChange,
    maxRecentChannels = 5,
    numberInputTimeout = 1500,
  } = options;

  const [recentChannels, setRecentChannels] = useState<Channel[]>([]);
  const [numberInput, setNumberInput] = useState('');
  const [isShowingOSD, setIsShowingOSD] = useState(false);
  
  const numberTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const osdTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get current channel index
  const currentIndex = currentChannel 
    ? channels.findIndex(ch => ch.id === currentChannel.id)
    : -1;

  // Add channel to recent list
  const addToRecent = useCallback((channel: Channel) => {
    setRecentChannels(prev => {
      const filtered = prev.filter(ch => ch.id !== channel.id);
      return [channel, ...filtered].slice(0, maxRecentChannels);
    });
  }, [maxRecentChannels]);

  // Go to next channel
  const nextChannel = useCallback(() => {
    if (channels.length === 0) return;
    
    const nextIndex = currentIndex < channels.length - 1 ? currentIndex + 1 : 0;
    const channel = channels[nextIndex];
    
    if (currentChannel) addToRecent(currentChannel);
    onChannelChange(channel);
    showOSD();
  }, [channels, currentIndex, currentChannel, onChannelChange, addToRecent]);

  // Go to previous channel
  const previousChannel = useCallback(() => {
    if (channels.length === 0) return;
    
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : channels.length - 1;
    const channel = channels[prevIndex];
    
    if (currentChannel) addToRecent(currentChannel);
    onChannelChange(channel);
    showOSD();
  }, [channels, currentIndex, currentChannel, onChannelChange, addToRecent]);

  // Go to specific channel by number
  const goToChannelNumber = useCallback((num: number) => {
    const index = num - 1; // Channel numbers start at 1
    if (index >= 0 && index < channels.length) {
      const channel = channels[index];
      if (currentChannel) addToRecent(currentChannel);
      onChannelChange(channel);
      showOSD();
      return true;
    }
    return false;
  }, [channels, currentChannel, onChannelChange, addToRecent]);

  // Go to last watched channel (zap back)
  const zapBack = useCallback(() => {
    if (recentChannels.length > 0) {
      const lastChannel = recentChannels[0];
      if (currentChannel) addToRecent(currentChannel);
      onChannelChange(lastChannel);
      showOSD();
    }
  }, [recentChannels, currentChannel, onChannelChange, addToRecent]);

  // Handle number key input
  const handleNumberInput = useCallback((digit: string) => {
    // Clear any existing timeout
    if (numberTimeoutRef.current) {
      clearTimeout(numberTimeoutRef.current);
    }

    const newInput = numberInput + digit;
    setNumberInput(newInput);
    showOSD();

    // Set timeout to process number
    numberTimeoutRef.current = setTimeout(() => {
      const channelNum = parseInt(newInput, 10);
      if (!isNaN(channelNum)) {
        goToChannelNumber(channelNum);
      }
      setNumberInput('');
    }, numberInputTimeout);
  }, [numberInput, numberInputTimeout, goToChannelNumber]);

  // Clear number input
  const clearNumberInput = useCallback(() => {
    if (numberTimeoutRef.current) {
      clearTimeout(numberTimeoutRef.current);
    }
    setNumberInput('');
  }, []);

  // Show OSD (On Screen Display)
  const showOSD = useCallback(() => {
    setIsShowingOSD(true);
    
    if (osdTimeoutRef.current) {
      clearTimeout(osdTimeoutRef.current);
    }
    
    osdTimeoutRef.current = setTimeout(() => {
      setIsShowingOSD(false);
    }, 3000);
  }, []);

  // Hide OSD
  const hideOSD = useCallback(() => {
    setIsShowingOSD(false);
    if (osdTimeoutRef.current) {
      clearTimeout(osdTimeoutRef.current);
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'ArrowUp':
        case 'ChannelUp':
          e.preventDefault();
          previousChannel();
          break;
        case 'ArrowDown':
        case 'ChannelDown':
          e.preventDefault();
          nextChannel();
          break;
        case 'Backspace':
          e.preventDefault();
          zapBack();
          break;
        default:
          // Handle number keys
          if (/^[0-9]$/.test(e.key)) {
            e.preventDefault();
            handleNumberInput(e.key);
          }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextChannel, previousChannel, zapBack, handleNumberInput]);

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (numberTimeoutRef.current) clearTimeout(numberTimeoutRef.current);
      if (osdTimeoutRef.current) clearTimeout(osdTimeoutRef.current);
    };
  }, []);

  return {
    currentIndex,
    totalChannels: channels.length,
    recentChannels,
    numberInput,
    isShowingOSD,
    nextChannel,
    previousChannel,
    goToChannelNumber,
    zapBack,
    handleNumberInput,
    clearNumberInput,
    showOSD,
    hideOSD,
    // Get channel number for display (1-indexed)
    getChannelNumber: (channel: Channel) => {
      const index = channels.findIndex(ch => ch.id === channel.id);
      return index >= 0 ? index + 1 : null;
    },
  };
}
