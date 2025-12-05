/**
 * AppLayout - Fullscreen layout for /app/* routes
 * 
 * Creates a native-app-like experience:
 * - Fixed fullscreen positioning (no scroll)
 * - Portrait orientation locked by default
 * - Safe area handling for notched devices
 */

import { useEffect, ReactNode } from 'react';
import { useOrientationLock } from '@/hooks/useOrientationLock';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: ReactNode;
  className?: string;
  allowScroll?: boolean;
}

export function AppLayout({ children, className, allowScroll = false }: AppLayoutProps) {
  const { lockToPortrait } = useOrientationLock();

  // Lock to portrait on mount
  useEffect(() => {
    lockToPortrait();
    
    // Add app-mode class to body for global styles
    document.body.classList.add('app-mode');
    
    // Prevent pull-to-refresh and bounce scroll on iOS
    document.body.style.overscrollBehavior = 'none';
    
    return () => {
      document.body.classList.remove('app-mode');
      document.body.style.overscrollBehavior = '';
    };
  }, [lockToPortrait]);

  return (
    <div
      className={cn(
        // Fixed fullscreen positioning
        'fixed inset-0 w-full h-full',
        // Safe area handling for notched devices
        'pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]',
        'pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]',
        // Background
        'bg-background',
        // Scroll control
        allowScroll ? 'overflow-y-auto overflow-x-hidden' : 'overflow-hidden',
        // Custom classes
        className
      )}
    >
      {children}
    </div>
  );
}

export default AppLayout;
