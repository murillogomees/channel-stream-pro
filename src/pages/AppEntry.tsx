import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { Network } from "@capacitor/network";
import AnimatedSplash from "@/components/app/AnimatedSplash";
import { deviceDetector } from "@/modules/player/core/DeviceDetector";
import { toast } from "sonner";

const AppEntry = () => {
  const navigate = useNavigate();
  const [showSplash, setShowSplash] = useState(true);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Configurar status bar em plataformas nativas
        if (Capacitor.isNativePlatform()) {
          await StatusBar.setStyle({ style: Style.Dark });
          await StatusBar.setBackgroundColor({ color: "#0A0A0A" });
          
          // Esconder splash nativo do Capacitor
          await SplashScreen.hide();
        }

        // Verificar conectividade
        const status = await Network.getStatus();
        setIsOnline(status.connected);

        if (!status.connected) {
          toast.error("Sem conexão com a internet", {
            description: "Verifique sua conexão e tente novamente",
          });
        }

        // Listener para mudanças de conectividade
        Network.addListener("networkStatusChange", (status) => {
          setIsOnline(status.connected);
          if (!status.connected) {
            toast.error("Conexão perdida");
          } else {
            toast.success("Conexão restaurada");
          }
        });
      } catch (error) {
        console.log("Capacitor plugins not available:", error);
      }
    };

    initializeApp();

    return () => {
      Network.removeAllListeners();
    };
  }, []);

  const handleSplashComplete = () => {
    setShowSplash(false);

    // Detectar tipo de dispositivo usando DeviceDetector
    const isTv = deviceDetector.isTv;
    const isMobile = deviceDetector.isMobile;
    const platform = Capacitor.getPlatform();

    console.log("Device detection:", { isTv, isMobile, platform });

    // Redirecionar baseado no dispositivo
    if (isTv) {
      // Smart TV - usar player TV
      navigate("/tv-player", { replace: true });
    } else if (platform === "android" || platform === "ios" || isMobile) {
      // Mobile ou tablet - usar player mobile
      navigate("/app/player", { replace: true });
    } else {
      // Web desktop - redirecionar para conta
      navigate("/conta", { replace: true });
    }
  };

  if (showSplash) {
    return <AnimatedSplash onComplete={handleSplashComplete} minDuration={2500} />;
  }

  // Tela de loading caso não tenha conexão
  if (!isOnline) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/20 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-destructive"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 5.636a9 9 0 010 12.728m-3.536-3.536a4 4 0 010-5.656m-7.072 7.072a9 9 0 010-12.728m3.536 3.536a4 4 0 010 5.656"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Sem conexão
          </h2>
          <p className="text-muted-foreground mb-4">
            Verifique sua conexão com a internet
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default AppEntry;
