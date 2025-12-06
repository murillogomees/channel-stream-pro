/**
 * Player Settings Panel - Complete Edition
 * 
 * All player configuration options with tabbed organization
 */

import React, { useState } from 'react';
import { 
  Settings, X, Volume2, VolumeX, Play, Zap, RefreshCw, Image,
  Monitor, Gauge, Sun, Moon, Type, Languages, PictureInPicture,
  Clock, SkipForward, Baby, Maximize, Keyboard, Hand, Cast,
  Timer, BarChart3, Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { VideoFilters, AspectRatio } from '../hooks/useAdvancedPlayerControls';

export interface PlayerSettings {
  // Basic
  autoplay: boolean;
  muted: boolean;
  preferLowLatency: boolean;
  maxRetries: number;
  showPoster: boolean;
  // Playback
  defaultSpeed: number;
  preferredQuality: 'auto' | '480p' | '720p' | '1080p' | '4k';
  // Display
  defaultAspectRatio: AspectRatio;
  defaultFilters: VideoFilters;
  // Features
  enablePip: boolean;
  enableBingeWatching: boolean;
  skipIntroSeconds: number;
  enableSaveProgress: boolean;
  // Controls
  enableTouchGestures: boolean;
  enableKeyboardShortcuts: boolean;
  // Parental
  parentalControlEnabled: boolean;
  parentalAgeRating: number;
  // Timer
  defaultSleepTimer: number | null;
}

const DEFAULT_SETTINGS: PlayerSettings = {
  autoplay: true,
  muted: false,
  preferLowLatency: true,
  maxRetries: 3,
  showPoster: true,
  defaultSpeed: 1,
  preferredQuality: 'auto',
  defaultAspectRatio: 'auto',
  defaultFilters: { brightness: 100, contrast: 100, saturation: 100 },
  enablePip: true,
  enableBingeWatching: true,
  skipIntroSeconds: 0,
  enableSaveProgress: true,
  enableTouchGestures: true,
  enableKeyboardShortcuts: true,
  parentalControlEnabled: false,
  parentalAgeRating: 18,
  defaultSleepTimer: null,
};

const STORAGE_KEY = 'iptv-player-settings-v2';

export function loadPlayerSettings(): PlayerSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.warn('[PlayerSettings] Error loading:', e);
  }
  return DEFAULT_SETTINGS;
}

export function savePlayerSettings(settings: PlayerSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('[PlayerSettings] Error saving:', e);
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
  const [activeTab, setActiveTab] = useState('playback');

  const updateSetting = <K extends keyof PlayerSettings>(key: K, value: PlayerSettings[K]) => {
    const newSettings = { ...settings, [key]: value };
    onSettingsChange(newSettings);
    savePlayerSettings(newSettings);
  };

  const updateFilter = (key: keyof VideoFilters, value: number) => {
    const newFilters = { ...settings.defaultFilters, [key]: value };
    updateSetting('defaultFilters', newFilters);
  };

  if (!isOpen) return null;

  return (
    <div 
      className={cn(
        'absolute right-0 top-0 bottom-0 w-96 max-w-full',
        'bg-background/95 backdrop-blur-xl border-l border-border',
        'z-50 flex flex-col animate-in slide-in-from-right duration-300',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Configurações do Player</h3>
        </div>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-muted transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid grid-cols-4 mx-4 mt-2">
          <TabsTrigger value="playback" className="text-xs">Reprodução</TabsTrigger>
          <TabsTrigger value="display" className="text-xs">Exibição</TabsTrigger>
          <TabsTrigger value="features" className="text-xs">Recursos</TabsTrigger>
          <TabsTrigger value="controls" className="text-xs">Controles</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto p-4">
          {/* PLAYBACK TAB */}
          <TabsContent value="playback" className="mt-0 space-y-5">
            {/* Autoplay */}
            <SettingRow
              icon={<Play className="w-4 h-4 text-primary" />}
              iconBg="bg-primary/10"
              title="Reprodução Automática"
              description="Iniciar vídeo automaticamente"
            >
              <Switch checked={settings.autoplay} onCheckedChange={(v) => updateSetting('autoplay', v)} />
            </SettingRow>

            {/* Muted */}
            <SettingRow
              icon={settings.muted ? <VolumeX className="w-4 h-4 text-orange-500" /> : <Volume2 className="w-4 h-4 text-orange-500" />}
              iconBg="bg-orange-500/10"
              title="Iniciar Mudo"
              description="Começar sem som"
            >
              <Switch checked={settings.muted} onCheckedChange={(v) => updateSetting('muted', v)} />
            </SettingRow>

            {/* Low Latency */}
            <SettingRow
              icon={<Zap className="w-4 h-4 text-green-500" />}
              iconBg="bg-green-500/10"
              title="Baixa Latência"
              description="Menos delay para lives"
            >
              <Switch checked={settings.preferLowLatency} onCheckedChange={(v) => updateSetting('preferLowLatency', v)} />
            </SettingRow>

            {/* Preferred Quality */}
            <SettingRow
              icon={<Monitor className="w-4 h-4 text-blue-500" />}
              iconBg="bg-blue-500/10"
              title="Qualidade Preferida"
              description="Resolução padrão do vídeo"
            >
              <Select value={settings.preferredQuality} onValueChange={(v: any) => updateSetting('preferredQuality', v)}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="480p">480p</SelectItem>
                  <SelectItem value="720p">720p</SelectItem>
                  <SelectItem value="1080p">1080p</SelectItem>
                  <SelectItem value="4k">4K</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>

            {/* Playback Speed */}
            <SettingRow
              icon={<Gauge className="w-4 h-4 text-purple-500" />}
              iconBg="bg-purple-500/10"
              title="Velocidade Padrão"
              description="Velocidade de reprodução"
            >
              <Select value={settings.defaultSpeed.toString()} onValueChange={(v) => updateSetting('defaultSpeed', parseFloat(v))}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.5">0.5x</SelectItem>
                  <SelectItem value="0.75">0.75x</SelectItem>
                  <SelectItem value="1">1x</SelectItem>
                  <SelectItem value="1.25">1.25x</SelectItem>
                  <SelectItem value="1.5">1.5x</SelectItem>
                  <SelectItem value="2">2x</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>

            {/* Max Retries */}
            <div className="space-y-3">
              <SettingRow
                icon={<RefreshCw className="w-4 h-4 text-cyan-500" />}
                iconBg="bg-cyan-500/10"
                title="Tentativas de Reconexão"
                description="Quantas vezes tentar"
              >
                <span className="text-sm font-mono bg-muted px-2 py-1 rounded">{settings.maxRetries}x</span>
              </SettingRow>
              <Slider
                value={[settings.maxRetries]}
                onValueChange={([v]) => updateSetting('maxRetries', v)}
                min={1}
                max={10}
                step={1}
              />
            </div>
          </TabsContent>

          {/* DISPLAY TAB */}
          <TabsContent value="display" className="mt-0 space-y-5">
            {/* Aspect Ratio */}
            <SettingRow
              icon={<Maximize className="w-4 h-4 text-indigo-500" />}
              iconBg="bg-indigo-500/10"
              title="Proporção da Tela"
              description="Como o vídeo preenche a tela"
            >
              <Select value={settings.defaultAspectRatio} onValueChange={(v: AspectRatio) => updateSetting('defaultAspectRatio', v)}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="16:9">16:9</SelectItem>
                  <SelectItem value="4:3">4:3</SelectItem>
                  <SelectItem value="fill">Preencher</SelectItem>
                  <SelectItem value="original">Original</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>

            {/* Show Poster */}
            <SettingRow
              icon={<Image className="w-4 h-4 text-pink-500" />}
              iconBg="bg-pink-500/10"
              title="Mostrar Poster"
              description="Exibir capa antes de reproduzir"
            >
              <Switch checked={settings.showPoster} onCheckedChange={(v) => updateSetting('showPoster', v)} />
            </SettingRow>

            {/* Brightness */}
            <div className="space-y-3">
              <SettingRow
                icon={<Sun className="w-4 h-4 text-yellow-500" />}
                iconBg="bg-yellow-500/10"
                title="Brilho"
                description="Ajuste de luminosidade"
              >
                <span className="text-sm font-mono bg-muted px-2 py-1 rounded">{settings.defaultFilters.brightness}%</span>
              </SettingRow>
              <Slider
                value={[settings.defaultFilters.brightness]}
                onValueChange={([v]) => updateFilter('brightness', v)}
                min={50}
                max={150}
                step={5}
              />
            </div>

            {/* Contrast */}
            <div className="space-y-3">
              <SettingRow
                icon={<Moon className="w-4 h-4 text-slate-500" />}
                iconBg="bg-slate-500/10"
                title="Contraste"
                description="Diferença claro/escuro"
              >
                <span className="text-sm font-mono bg-muted px-2 py-1 rounded">{settings.defaultFilters.contrast}%</span>
              </SettingRow>
              <Slider
                value={[settings.defaultFilters.contrast]}
                onValueChange={([v]) => updateFilter('contrast', v)}
                min={50}
                max={150}
                step={5}
              />
            </div>

            {/* Saturation */}
            <div className="space-y-3">
              <SettingRow
                icon={<div className="w-4 h-4 rounded-full bg-gradient-to-r from-red-500 via-green-500 to-blue-500" />}
                iconBg="bg-gradient-to-r from-red-500/10 via-green-500/10 to-blue-500/10"
                title="Saturação"
                description="Intensidade das cores"
              >
                <span className="text-sm font-mono bg-muted px-2 py-1 rounded">{settings.defaultFilters.saturation}%</span>
              </SettingRow>
              <Slider
                value={[settings.defaultFilters.saturation]}
                onValueChange={([v]) => updateFilter('saturation', v)}
                min={0}
                max={200}
                step={10}
              />
            </div>

            {/* Reset Filters */}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => updateSetting('defaultFilters', { brightness: 100, contrast: 100, saturation: 100 })}
            >
              Resetar Ajustes de Imagem
            </Button>
          </TabsContent>

          {/* FEATURES TAB */}
          <TabsContent value="features" className="mt-0 space-y-5">
            {/* PiP */}
            <SettingRow
              icon={<PictureInPicture className="w-4 h-4 text-teal-500" />}
              iconBg="bg-teal-500/10"
              title="Picture-in-Picture"
              description="Janela flutuante"
            >
              <Switch checked={settings.enablePip} onCheckedChange={(v) => updateSetting('enablePip', v)} />
            </SettingRow>

            {/* Save Progress */}
            <SettingRow
              icon={<Clock className="w-4 h-4 text-amber-500" />}
              iconBg="bg-amber-500/10"
              title="Salvar Progresso"
              description="Continuar de onde parou"
            >
              <Switch checked={settings.enableSaveProgress} onCheckedChange={(v) => updateSetting('enableSaveProgress', v)} />
            </SettingRow>

            {/* Binge Watching */}
            <SettingRow
              icon={<SkipForward className="w-4 h-4 text-rose-500" />}
              iconBg="bg-rose-500/10"
              title="Binge-Watching"
              description="Próximo episódio automático"
            >
              <Switch checked={settings.enableBingeWatching} onCheckedChange={(v) => updateSetting('enableBingeWatching', v)} />
            </SettingRow>

            {/* Skip Intro */}
            <div className="space-y-3">
              <SettingRow
                icon={<SkipForward className="w-4 h-4 text-violet-500" />}
                iconBg="bg-violet-500/10"
                title="Pular Abertura"
                description="Segundos para avançar"
              >
                <span className="text-sm font-mono bg-muted px-2 py-1 rounded">{settings.skipIntroSeconds}s</span>
              </SettingRow>
              <Slider
                value={[settings.skipIntroSeconds]}
                onValueChange={([v]) => updateSetting('skipIntroSeconds', v)}
                min={0}
                max={120}
                step={5}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Desativado</span>
                <span>2 min</span>
              </div>
            </div>

            {/* Sleep Timer */}
            <SettingRow
              icon={<Timer className="w-4 h-4 text-sky-500" />}
              iconBg="bg-sky-500/10"
              title="Timer de Desligamento"
              description="Parar após X minutos"
            >
              <Select 
                value={settings.defaultSleepTimer?.toString() || 'off'} 
                onValueChange={(v) => updateSetting('defaultSleepTimer', v === 'off' ? null : parseInt(v))}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">Desligado</SelectItem>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">1 hora</SelectItem>
                  <SelectItem value="90">1h30</SelectItem>
                  <SelectItem value="120">2 horas</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>

            {/* Parental Control */}
            <SettingRow
              icon={<Shield className="w-4 h-4 text-red-500" />}
              iconBg="bg-red-500/10"
              title="Controle Parental"
              description="Bloquear conteúdo adulto"
            >
              <Switch checked={settings.parentalControlEnabled} onCheckedChange={(v) => updateSetting('parentalControlEnabled', v)} />
            </SettingRow>

            {settings.parentalControlEnabled && (
              <SettingRow
                icon={<Baby className="w-4 h-4 text-red-400" />}
                iconBg="bg-red-400/10"
                title="Classificação Máxima"
                description="Idade permitida"
              >
                <Select 
                  value={settings.parentalAgeRating.toString()} 
                  onValueChange={(v) => updateSetting('parentalAgeRating', parseInt(v))}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Livre</SelectItem>
                    <SelectItem value="10">10+</SelectItem>
                    <SelectItem value="12">12+</SelectItem>
                    <SelectItem value="14">14+</SelectItem>
                    <SelectItem value="16">16+</SelectItem>
                    <SelectItem value="18">18+</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>
            )}
          </TabsContent>

          {/* CONTROLS TAB */}
          <TabsContent value="controls" className="mt-0 space-y-5">
            {/* Touch Gestures */}
            <SettingRow
              icon={<Hand className="w-4 h-4 text-emerald-500" />}
              iconBg="bg-emerald-500/10"
              title="Gestos Touch"
              description="Deslizar para volume/brilho"
            >
              <Switch checked={settings.enableTouchGestures} onCheckedChange={(v) => updateSetting('enableTouchGestures', v)} />
            </SettingRow>

            {/* Keyboard Shortcuts */}
            <SettingRow
              icon={<Keyboard className="w-4 h-4 text-lime-500" />}
              iconBg="bg-lime-500/10"
              title="Atalhos de Teclado"
              description="Controlar com teclado"
            >
              <Switch checked={settings.enableKeyboardShortcuts} onCheckedChange={(v) => updateSetting('enableKeyboardShortcuts', v)} />
            </SettingRow>

            {/* Keyboard Shortcuts Help */}
            {settings.enableKeyboardShortcuts && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <h4 className="text-sm font-medium">Atalhos Disponíveis</h4>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div><kbd className="px-1.5 py-0.5 bg-background rounded">Espaço</kbd> Play/Pause</div>
                  <div><kbd className="px-1.5 py-0.5 bg-background rounded">F</kbd> Tela cheia</div>
                  <div><kbd className="px-1.5 py-0.5 bg-background rounded">M</kbd> Mudo</div>
                  <div><kbd className="px-1.5 py-0.5 bg-background rounded">P</kbd> PiP</div>
                  <div><kbd className="px-1.5 py-0.5 bg-background rounded">←/→</kbd> -/+ 10s</div>
                  <div><kbd className="px-1.5 py-0.5 bg-background rounded">↑/↓</kbd> Volume</div>
                  <div><kbd className="px-1.5 py-0.5 bg-background rounded">C</kbd> Legendas</div>
                  <div><kbd className="px-1.5 py-0.5 bg-background rounded">I</kbd> Info EPG</div>
                </div>
              </div>
            )}

            {/* Touch Gestures Help */}
            {settings.enableTouchGestures && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <h4 className="text-sm font-medium">Gestos Touch</h4>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div>↕️ Deslizar esquerda = Brilho</div>
                  <div>↕️ Deslizar direita = Volume</div>
                  <div>↔️ Deslizar horizontal = Seek</div>
                  <div>👆👆 Toque duplo = ±10s</div>
                </div>
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <button
          onClick={() => {
            onSettingsChange(DEFAULT_SETTINGS);
            savePlayerSettings(DEFAULT_SETTINGS);
          }}
          className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Restaurar Todos os Padrões
        </button>
      </div>
    </div>
  );
}

// Helper component for consistent setting rows
function SettingRow({ 
  icon, 
  iconBg, 
  title, 
  description, 
  children 
}: { 
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-lg', iconBg)}>
          {icon}
        </div>
        <div>
          <Label className="text-sm font-medium">{title}</Label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

// Hook for using player settings
export function usePlayerSettings() {
  const [settings, setSettings] = React.useState<PlayerSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = React.useState(false);

  React.useEffect(() => {
    setSettings(loadPlayerSettings());
    setIsLoaded(true);
  }, []);

  const updateSettings = (newSettings: PlayerSettings) => {
    setSettings(newSettings);
    savePlayerSettings(newSettings);
  };

  return { settings, updateSettings, isLoaded };
}

export default PlayerSettingsPanel;
