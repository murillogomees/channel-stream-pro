/**
 * Player Settings Panel
 * 
 * Exposes player configuration options in the UI
 */

import React, { useState, useEffect } from 'react';
import { 
  Settings, X, Volume2, VolumeX, Play, Zap, 
  RefreshCw, Image, ChevronRight 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

export interface PlayerSettings {
  autoplay: boolean;
  muted: boolean;
  preferLowLatency: boolean;
  maxRetries: number;
  showPoster: boolean;
}

const DEFAULT_SETTINGS: PlayerSettings = {
  autoplay: true,
  muted: false,
  preferLowLatency: true,
  maxRetries: 3,
  showPoster: true,
};

const STORAGE_KEY = 'iptv-player-settings';

export function loadPlayerSettings(): PlayerSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.warn('[PlayerSettings] Error loading settings:', e);
  }
  return DEFAULT_SETTINGS;
}

export function savePlayerSettings(settings: PlayerSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('[PlayerSettings] Error saving settings:', e);
  }
}

interface PlayerSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: PlayerSettings;
  onSettingsChange: (settings: PlayerSettings) => void;
  className?: string;
}

export function PlayerSettingsPanel({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
  className,
}: PlayerSettingsPanelProps) {
  const updateSetting = <K extends keyof PlayerSettings>(
    key: K, 
    value: PlayerSettings[K]
  ) => {
    const newSettings = { ...settings, [key]: value };
    onSettingsChange(newSettings);
    savePlayerSettings(newSettings);
  };

  if (!isOpen) return null;

  return (
    <div 
      className={cn(
        'absolute right-0 top-0 bottom-0 w-80 max-w-full',
        'bg-background/95 backdrop-blur-xl border-l border-border',
        'z-50 flex flex-col animate-in slide-in-from-right duration-300',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Configurações</h3>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-muted transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Settings List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Autoplay */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Play className="w-4 h-4 text-primary" />
              </div>
              <div>
                <Label className="text-sm font-medium">Reprodução Automática</Label>
                <p className="text-xs text-muted-foreground">
                  Iniciar vídeo automaticamente
                </p>
              </div>
            </div>
            <Switch
              checked={settings.autoplay}
              onCheckedChange={(checked) => updateSetting('autoplay', checked)}
            />
          </div>
        </div>

        {/* Muted */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                {settings.muted ? (
                  <VolumeX className="w-4 h-4 text-orange-500" />
                ) : (
                  <Volume2 className="w-4 h-4 text-orange-500" />
                )}
              </div>
              <div>
                <Label className="text-sm font-medium">Iniciar Mudo</Label>
                <p className="text-xs text-muted-foreground">
                  Começar sem som (evita surpresas)
                </p>
              </div>
            </div>
            <Switch
              checked={settings.muted}
              onCheckedChange={(checked) => updateSetting('muted', checked)}
            />
          </div>
        </div>

        {/* Low Latency */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Zap className="w-4 h-4 text-green-500" />
              </div>
              <div>
                <Label className="text-sm font-medium">Baixa Latência</Label>
                <p className="text-xs text-muted-foreground">
                  Menos delay para lives (buffer menor)
                </p>
              </div>
            </div>
            <Switch
              checked={settings.preferLowLatency}
              onCheckedChange={(checked) => updateSetting('preferLowLatency', checked)}
            />
          </div>
        </div>

        {/* Show Poster */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Image className="w-4 h-4 text-purple-500" />
              </div>
              <div>
                <Label className="text-sm font-medium">Mostrar Poster</Label>
                <p className="text-xs text-muted-foreground">
                  Exibir capa antes de reproduzir
                </p>
              </div>
            </div>
            <Switch
              checked={settings.showPoster}
              onCheckedChange={(checked) => updateSetting('showPoster', checked)}
            />
          </div>
        </div>

        {/* Max Retries */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <RefreshCw className="w-4 h-4 text-blue-500" />
            </div>
            <div className="flex-1">
              <Label className="text-sm font-medium">Tentativas de Reconexão</Label>
              <p className="text-xs text-muted-foreground">
                Quantas vezes tentar antes de erro
              </p>
            </div>
            <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
              {settings.maxRetries}x
            </span>
          </div>
          <Slider
            value={[settings.maxRetries]}
            onValueChange={([value]) => updateSetting('maxRetries', value)}
            min={1}
            max={10}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1x (rápido)</span>
            <span>10x (persistente)</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <button
          onClick={() => {
            onSettingsChange(DEFAULT_SETTINGS);
            savePlayerSettings(DEFAULT_SETTINGS);
          }}
          className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Restaurar Padrões
        </button>
      </div>
    </div>
  );
}

// Hook for using player settings
export function usePlayerSettings() {
  const [settings, setSettings] = useState<PlayerSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setSettings(loadPlayerSettings());
    setIsLoaded(true);
  }, []);

  const updateSettings = (newSettings: PlayerSettings) => {
    setSettings(newSettings);
    savePlayerSettings(newSettings);
  };

  return {
    settings,
    updateSettings,
    isLoaded,
  };
}

export default PlayerSettingsPanel;
