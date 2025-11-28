import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.iptvlink.player",
  appName: "IPTV Link",
  webDir: "dist",
  server: {
    // Para desenvolvimento - comentar em produção
    url: "https://a6d041f1-9e96-49e8-bc86-f2d4dd4bc0b2.lovableproject.com?forceHideBadge=true",
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: false,
      backgroundColor: "#0A0A0A",
      showSpinner: false,
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
      // Lock to portrait on phones, allow landscape on tablets/TV
    },
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    backgroundColor: "#0A0A0A",
  },
  ios: {
    contentInset: "automatic",
    allowsLinkPreview: false,
    scrollEnabled: true,
    backgroundColor: "#0A0A0A",
  },
};

export default config;
