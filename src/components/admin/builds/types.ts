/**
 * Types for Build & Deploy System
 */

export type PlatformType = 'mobile_tv' | 'mobile_tablet' | 'pwa' | 'smart_tv' | 'desktop' | 'optional';

export type PlatformName = 
  | 'android' 
  | 'ios' 
  | 'web' 
  | 'tizen' 
  | 'webos' 
  | 'roku' 
  | 'desktop' 
  | 'console';

export type BuildStatus = 'idle' | 'queued' | 'building' | 'testing' | 'deploying' | 'success' | 'failed' | 'cancelled';

export interface PlayerConfig {
  webWorkers: boolean;
  buffer: number;
  lowLatency: boolean;
  retries: number;
  fragmentSize: number;
}

export interface PlatformPaths {
  src: string;
  assets?: string;
  public?: string;
  build: string;
}

export interface PlatformScripts {
  compile: string;
  sign?: string;
  test?: string;
  package?: string;
  deploy: string;
}

export interface Platform {
  name: PlatformName;
  priority: number;
  type: PlatformType;
  paths: PlatformPaths;
  developerAccount?: string;
  scripts: PlatformScripts;
  playerConfig: PlayerConfig;
}

export interface BuildJob {
  id: string;
  platform: PlatformName;
  status: BuildStatus;
  progress: number;
  startedAt?: string;
  completedAt?: string;
  logs: string[];
  error?: string;
  version?: string;
  artifactUrl?: string;
}

export interface CiCdConfig {
  autoTest: boolean;
  emulatorSimulation: boolean;
  logMonitoring: boolean;
  failureAlert: boolean;
  successNotification: boolean;
  sequentialBuild: boolean;
  buildOrder: PlatformName[];
}

export interface AutomationConfig {
  triggerAllBuilds: boolean;
  notifyOnComplete: boolean;
  retryOnFail: boolean;
}

export interface BuildSystemConfig {
  platforms: Platform[];
  ciCd: CiCdConfig;
  automation: AutomationConfig;
}

export const DEFAULT_PLATFORMS: Platform[] = [
  {
    name: 'android',
    priority: 1,
    type: 'mobile_tv',
    paths: { src: '/apps/android/src', assets: '/apps/android/assets', build: '/apps/android/build' },
    developerAccount: 'GoogleDevAccount',
    scripts: { compile: 'compileAPK()', sign: 'signAPK(GoogleDevAccount)', test: 'testEmulator("Android")', deploy: 'uploadToGooglePlay()' },
    playerConfig: { webWorkers: true, buffer: 20, lowLatency: false, retries: 4, fragmentSize: 2 }
  },
  {
    name: 'ios',
    priority: 2,
    type: 'mobile_tablet',
    paths: { src: '/apps/ios/src', assets: '/apps/ios/assets', build: '/apps/ios/build' },
    developerAccount: 'AppleDevAccount',
    scripts: { compile: 'compileIPA()', sign: 'signIPA(AppleDevAccount)', test: 'testSimulator("iOS")', deploy: 'uploadToTestFlight()' },
    playerConfig: { webWorkers: true, buffer: 20, lowLatency: false, retries: 4, fragmentSize: 2 }
  },
  {
    name: 'web',
    priority: 3,
    type: 'pwa',
    paths: { src: '/apps/web/src', public: '/apps/web/public', build: '/apps/web/build' },
    scripts: { compile: 'buildPWA()', test: 'runLighthouseTests()', deploy: 'deployWebServer()' },
    playerConfig: { webWorkers: true, buffer: 20, lowLatency: false, retries: 4, fragmentSize: 2 }
  },
  {
    name: 'tizen',
    priority: 4,
    type: 'smart_tv',
    paths: { src: '/apps/smart-tv/tizen/src', build: '/apps/smart-tv/tizen/build' },
    developerAccount: 'SamsungDevAccount',
    scripts: { compile: 'compileTizen()', deploy: 'uploadTizenStore()' },
    playerConfig: { webWorkers: false, buffer: 30, lowLatency: false, retries: 6, fragmentSize: 4 }
  },
  {
    name: 'webos',
    priority: 4,
    type: 'smart_tv',
    paths: { src: '/apps/smart-tv/webos/src', build: '/apps/smart-tv/webos/build' },
    developerAccount: 'LGDevAccount',
    scripts: { compile: 'compileWebOS()', deploy: 'uploadWebOSStore()' },
    playerConfig: { webWorkers: true, buffer: 30, lowLatency: false, retries: 5, fragmentSize: 4 }
  },
  {
    name: 'roku',
    priority: 4,
    type: 'smart_tv',
    paths: { src: '/apps/smart-tv/roku/src', build: '/apps/smart-tv/roku/build' },
    developerAccount: 'RokuDevAccount',
    scripts: { compile: 'compileRoku()', deploy: 'uploadRokuChannel()' },
    playerConfig: { webWorkers: true, buffer: 20, lowLatency: false, retries: 4, fragmentSize: 2 }
  },
  {
    name: 'desktop',
    priority: 5,
    type: 'desktop',
    paths: { src: '/apps/desktop/electron/src', build: '/apps/desktop/electron/build' },
    scripts: { compile: 'buildElectron()', package: 'packageExecutables()', deploy: 'notifyDownloadAvailable()' },
    playerConfig: { webWorkers: true, buffer: 20, lowLatency: false, retries: 4, fragmentSize: 2 }
  },
  {
    name: 'console',
    priority: 6,
    type: 'optional',
    paths: { src: '/apps/console/src', build: '/apps/console/build' },
    developerAccount: 'ConsoleDevAccount',
    scripts: { compile: 'compileConsole()', deploy: 'uploadConsoleStore()' },
    playerConfig: { webWorkers: true, buffer: 20, lowLatency: false, retries: 4, fragmentSize: 2 }
  }
];

export const PLATFORM_ICONS: Record<PlatformName, string> = {
  android: '🤖',
  ios: '🍎',
  web: '🌐',
  tizen: '📺',
  webos: '📺',
  roku: '📺',
  desktop: '🖥️',
  console: '🎮'
};

export const PLATFORM_LABELS: Record<PlatformName, string> = {
  android: 'Android',
  ios: 'iOS',
  web: 'Web PWA',
  tizen: 'Samsung Tizen',
  webos: 'LG WebOS',
  roku: 'Roku',
  desktop: 'Desktop',
  console: 'Console'
};

export const BUILD_STATUS_COLORS: Record<BuildStatus, string> = {
  idle: 'bg-muted text-muted-foreground',
  queued: 'bg-yellow-500/20 text-yellow-500',
  building: 'bg-blue-500/20 text-blue-500',
  testing: 'bg-purple-500/20 text-purple-500',
  deploying: 'bg-orange-500/20 text-orange-500',
  success: 'bg-green-500/20 text-green-500',
  failed: 'bg-destructive/20 text-destructive',
  cancelled: 'bg-muted text-muted-foreground'
};
