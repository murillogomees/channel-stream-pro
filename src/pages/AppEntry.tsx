import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatedSplash } from '@/components/app/AnimatedSplash';
import { supabase } from '@/integrations/supabase/client';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { AppLayout } from '@/components/layouts/AppLayout';

export default function AppEntry() {
  const navigate = useNavigate();
  const [showSplash, setShowSplash] = useState(true);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Hide native splash screen when component mounts
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      SplashScreen.hide().catch(console.error);
    }
  }, []);

  const checkAuthAndRedirect = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        // User is logged in, go to player
        navigate('/app/player', { replace: true });
      } else {
        // User not logged in, go to unified login with return URL
        navigate('/login', { 
          replace: true,
          state: { from: { pathname: '/app/player' } }
        });
      }
    } catch (error) {
      console.error('Auth check error:', error);
      navigate('/login', { 
        replace: true,
        state: { from: { pathname: '/app/player' } }
      });
    } finally {
      setIsCheckingAuth(false);
    }
  }, [navigate]);

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
    checkAuthAndRedirect();
  }, [checkAuthAndRedirect]);

  // Show splash screen
  if (showSplash) {
    return (
      <AppLayout>
        <AnimatedSplash onComplete={handleSplashComplete} minDuration={2000} />
      </AppLayout>
    );
  }

  // Show loading while checking auth
  if (isCheckingAuth) {
    return (
      <AppLayout className="flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </AppLayout>
    );
  }

  return null;
}
