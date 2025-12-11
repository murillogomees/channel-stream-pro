import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { AdminBadge } from '@/types/badge';

export interface BadgeNotification {
  id: string;
  admin_id: string;
  badge_id: string;
  badge_name: string;
  badge_rarity: string;
  earned_at: string;
  read_at: string | null;
  created_at: string;
}

export function useBadgeNotifications(adminId: string | null) {
  const [notifications, setNotifications] = useState<BadgeNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!adminId) {
      setLoading(false);
      return;
    }

    loadNotifications();
    subscribeToNotifications();
  }, [adminId]);

  const loadNotifications = async () => {
    if (!adminId) return;

    try {
      const { data, error } = await supabase
        .from('admin_badge_notifications')
        .select('*')
        .eq('admin_id', adminId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      setNotifications((data || []).map(n => ({
        ...n,
        earned_at: n.created_at,
      })));
      setUnreadCount((data || []).filter(n => !n.read_at).length);
    } catch (error) {
      console.error('Error loading badge notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToNotifications = () => {
    if (!adminId) return;

    const channel = supabase
      .channel('badge-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'admin_badge_notifications',
          filter: `admin_id=eq.${adminId}`
        },
        (payload) => {
          const newNotification = payload.new as BadgeNotification;
          setNotifications(prev => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);
          
          // Trigger celebration
          triggerBadgeCelebration(newNotification);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('admin_badge_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!adminId) return;

    try {
      const { error } = await supabase
        .from('admin_badge_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('admin_id', adminId)
        .is('read_at', null);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const triggerBadgeCelebration = (notification: BadgeNotification) => {
    // Play sound
    const audio = new Audio('/badge-earned.mp3');
    audio.volume = 0.5;
    audio.play().catch(() => {});

    // Show browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('🏆 Novo Badge Conquistado!', {
        body: `Você conquistou o badge "${notification.badge_name}"!`,
        icon: '/logo.png',
        badge: '/logo.png',
        tag: notification.id
      });
    }

    // Trigger confetti or celebration animation
    if (typeof window !== 'undefined' && (window as any).confetti) {
      (window as any).confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refresh: loadNotifications
  };
}
