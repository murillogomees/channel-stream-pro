import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import logoWhite from "@/assets/logo-white.png";

interface AnimatedSplashProps {
  onComplete: () => void;
  minDuration?: number;
}

const AnimatedSplash = ({ onComplete, minDuration = 2000 }: AnimatedSplashProps) => {
  const [isVisible, setIsVisible] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);

  useEffect(() => {
    // Simular progresso de loading
    const progressInterval = setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + Math.random() * 15;
      });
    }, 100);

    // Timer mínimo para exibição
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onComplete, 500); // Aguardar animação de saída
    }, minDuration);

    return () => {
      clearTimeout(timer);
      clearInterval(progressInterval);
    };
  }, [onComplete, minDuration]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0A0A0A]"
        >
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5" />
          
          {/* Animated rings */}
          <div className="absolute">
            <motion.div
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.3, 0.1, 0.3],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="w-48 h-48 rounded-full border border-primary/30"
            />
          </div>
          <div className="absolute">
            <motion.div
              animate={{
                scale: [1.2, 1.8, 1.2],
                opacity: [0.2, 0.05, 0.2],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.3,
              }}
              className="w-64 h-64 rounded-full border border-primary/20"
            />
          </div>

          {/* Logo */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              duration: 0.8,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="relative z-10 mb-8"
          >
            <img
              src={logoWhite}
              alt="IPTV Link"
              className="h-20 w-auto drop-shadow-2xl"
            />
          </motion.div>

          {/* App name */}
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-2xl font-bold text-foreground mb-2"
          >
            IPTV Link
          </motion.h1>

          {/* Tagline */}
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="text-sm text-muted-foreground mb-8"
          >
            TV Online em Full HD e 4K
          </motion.p>

          {/* Loading bar */}
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 200, opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.4 }}
            className="relative h-1 bg-muted rounded-full overflow-hidden"
          >
            <motion.div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-primary/70 rounded-full"
              style={{ width: `${Math.min(loadingProgress, 100)}%` }}
              transition={{ duration: 0.2 }}
            />
          </motion.div>

          {/* Loading text */}
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-4 text-xs text-muted-foreground"
          >
            Carregando...
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AnimatedSplash;
