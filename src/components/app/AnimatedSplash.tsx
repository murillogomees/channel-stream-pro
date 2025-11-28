import { useEffect, useState } from 'react';
import { Tv, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnimatedSplashProps {
  onComplete: () => void;
  minDuration?: number;
}

export function AnimatedSplash({ onComplete, minDuration = 2000 }: AnimatedSplashProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [progress, setProgress] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / minDuration) * 100, 100);
      setProgress(newProgress);

      if (newProgress >= 100) {
        clearInterval(interval);
        setFadeOut(true);
        setTimeout(onComplete, 500);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [minDuration, onComplete]);

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex flex-col items-center justify-center bg-background',
        'transition-opacity duration-500',
        fadeOut && 'opacity-0'
      )}
    >
      {/* Logo Animation */}
      <div className="relative mb-8">
        <div
          className={cn(
            'w-24 h-24 rounded-2xl bg-primary/10 flex items-center justify-center',
            'animate-pulse'
          )}
        >
          <Tv className="w-12 h-12 text-primary animate-bounce" />
        </div>
        
        {/* Glow effect */}
        <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl animate-pulse" />
      </div>

      {/* App Name */}
      <h1 className="text-3xl font-bold text-foreground mb-2 animate-fade-in">
        IPTV Link
      </h1>
      <p className="text-muted-foreground text-sm mb-8">
        TV Online em HD e 4K
      </p>

      {/* Progress Bar */}
      <div className="w-48 h-1 bg-muted rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-primary transition-all duration-100 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Connection Status */}
      <div className="flex items-center gap-2 text-sm">
        {isOnline ? (
          <>
            <Wifi className="w-4 h-4 text-green-500" />
            <span className="text-muted-foreground">Conectado</span>
          </>
        ) : (
          <>
            <WifiOff className="w-4 h-4 text-destructive" />
            <span className="text-destructive">Sem conexão</span>
          </>
        )}
      </div>
    </div>
  );
}
