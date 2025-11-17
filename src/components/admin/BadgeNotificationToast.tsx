import { useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { BadgeNotification } from '@/hooks/useBadgeNotifications';

interface BadgeNotificationToastProps {
  notification: BadgeNotification | null;
  onClose: () => void;
}

export function BadgeNotificationToast({ notification, onClose }: BadgeNotificationToastProps) {
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        onClose();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [notification, onClose]);

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'from-yellow-500 to-orange-500';
      case 'epic': return 'from-purple-500 to-pink-500';
      case 'rare': return 'from-blue-500 to-cyan-500';
      default: return 'from-gray-400 to-gray-500';
    }
  };

  const getRarityBadgeVariant = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'default';
      case 'epic': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <AnimatePresence>
      {notification && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.8 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="fixed top-20 right-6 z-50 max-w-sm"
        >
          <Card className={`relative overflow-hidden border-2 shadow-2xl bg-gradient-to-br ${getRarityColor(notification.badge_rarity)} p-[2px]`}>
            <div className="bg-background rounded-md p-4">
              <button
                onClick={onClose}
                className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <motion.div
                    animate={{ rotate: [0, -10, 10, -10, 0] }}
                    transition={{ duration: 0.5, repeat: 2 }}
                    className="text-4xl"
                  >
                    🏆
                  </motion.div>
                  <div>
                    <h3 className="font-bold text-lg">Novo Badge Conquistado!</h3>
                    <Badge variant={getRarityBadgeVariant(notification.badge_rarity)} className="text-xs">
                      {notification.badge_rarity}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="font-semibold text-base">{notification.badge_name}</p>
                  <p className="text-sm text-muted-foreground">
                    Continue assim para desbloquear mais conquistas!
                  </p>
                </div>

                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="text-center text-3xl"
                >
                  ✨
                </motion.div>
              </div>
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
