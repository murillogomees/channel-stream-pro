import { useState, useEffect, useRef } from 'react';
import { AutoNotificationScheduler } from '@/services/autoNotificationService';
import { useWhatsAppConfig } from './useWhatsAppConfig';
import { LastRunState } from '@/types/notificationHistory';

export function useAutoNotifications() {
  const schedulerRef = useRef<AutoNotificationScheduler | null>(null);
  const { config } = useWhatsAppConfig();
  const [isRunning, setIsRunning] = useState(false);
  const [lastRunState, setLastRunState] = useState<LastRunState | null>(null);

  useEffect(() => {
    if (!schedulerRef.current) {
      schedulerRef.current = new AutoNotificationScheduler();
      setLastRunState(schedulerRef.current.getLastRunState());
    }

    const scheduler = schedulerRef.current;

    if (config.autoSendEnabled) {
      scheduler.start();
      setIsRunning(true);
    } else {
      scheduler.stop();
      setIsRunning(false);
    }

    // Atualizar estado a cada minuto
    const interval = setInterval(() => {
      setLastRunState(scheduler.getLastRunState());
      setIsRunning(scheduler.getIsRunning());
    }, 60000);

    return () => {
      clearInterval(interval);
      if (schedulerRef.current) {
        schedulerRef.current.stop();
      }
    };
  }, [config.autoSendEnabled]);

  const forceRun = async () => {
    if (schedulerRef.current) {
      await schedulerRef.current.checkAndSend();
      setLastRunState(schedulerRef.current.getLastRunState());
    }
  };

  const getNextRunTime = () => {
    if (schedulerRef.current) {
      return schedulerRef.current.getNextRunTime(config);
    }
    return null;
  };

  return {
    isRunning,
    lastRunState,
    forceRun,
    getNextRunTime,
  };
}
