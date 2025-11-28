import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.iptvlink.app",
  appName: "IPTV Link",
  webDir: "dist",
  server: {
    // Para desenvolvimento - REMOVER EM PRODUÇÃO
    url: "https://a6d041f1-9e96-49e8-bc86-f2d4dd4bc0b2.lovableproject.com?forceHideBadge=true",
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2500,
      launchAutoHide: false,
      backgroundColor: "#0A0A0A",
      showSpinner: false,
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      splashFullScreen: true,
      splashImmersive: true,
      layoutName: "launch_screen",
      useDialog: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0A0A0A",
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
    ScreenOrientation: {
      // Permitir rotação no player
    },
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    backgroundColor: "#0A0A0A",
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
  ios: {
    contentInset: "automatic",
    allowsLinkPreview: false,
    scrollEnabled: true,
    backgroundColor: "#0A0A0A",
    preferredContentMode: "mobile",
  },
};

export default config;
