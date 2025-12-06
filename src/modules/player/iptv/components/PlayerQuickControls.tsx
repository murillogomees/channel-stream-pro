/**
 * Player Quick Controls
 * 
 * Runtime controls for quality, speed, subtitles, etc. (popup menus)
 */

import React, { useState } from 'react';
import { 
  Settings, Monitor, Gauge, Type, Languages, PictureInPicture,
  Timer, BarChart3, Check, ChevronLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QualityLevel, AudioTrack, SubtitleTrack, AspectRatio, PlayerStats } from '../hooks/useAdvancedPlayerControls';

type QuickMenu = 'main' | 'quality' | 'speed' | 'audio' | 'subtitles' | 'aspect' | 'timer' | 'stats';

interface PlayerQuickControlsProps {
  isOpen: boolean;
  onClose: () => void;
  // Quality
  qualities: QualityLevel[];
  currentQuality: number;
  onQualityChange: (level: number) => void;
  // Speed
  currentSpeed: number;
  onSpeedChange: (speed: number) => void;
  // Audio
  audioTracks: AudioTrack[];
  currentAudioTrack: number;
  onAudioChange: (track: number) => void;
  // Subtitles
  subtitleTracks: SubtitleTrack[];
  currentSubtitle: number;
  onSubtitleChange: (track: number) => void;
  onSubtitleDisable: () => void;
  // Aspect Ratio
  currentAspect: AspectRatio;
  onAspectChange: (ratio: AspectRatio) => void;
  // PiP
  isPipSupported: boolean;
  isPipActive: boolean;
  onTogglePip: () => void;
  // Stats
  showStats: boolean;
  stats: PlayerStats;
  onToggleStats: () => void;
  // Sleep Timer
  sleepTimerRemaining: number | null;
  onSetSleepTimer: (minutes: number | null) => void;
  className?: string;
}

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const ASPECTS: { value: AspectRatio; label: string }[] = [
  { value: 'auto', label: 'Automático' },
  { value: '16:9', label: '16:9 (Widescreen)' },
  { value: '4:3', label: '4:3 (Clássico)' },
  { value: 'fill', label: 'Preencher Tela' },
  { value: 'original', label: 'Original' },
];
const TIMER_OPTIONS = [
  { value: null, label: 'Desligado' },
  { value: 15, label: '15 minutos' },
  { value: 30, label: '30 minutos' },
  { value: 45, label: '45 minutos' },
  { value: 60, label: '1 hora' },
  { value: 90, label: '1h 30min' },
  { value: 120, label: '2 horas' },
];

export function PlayerQuickControls({
  isOpen,
  onClose,
  qualities,
  currentQuality,
  onQualityChange,
  currentSpeed,
  onSpeedChange,
  audioTracks,
  currentAudioTrack,
  onAudioChange,
  subtitleTracks,
  currentSubtitle,
  onSubtitleChange,
  onSubtitleDisable,
  currentAspect,
  onAspectChange,
  isPipSupported,
  isPipActive,
  onTogglePip,
  showStats,
  stats,
  onToggleStats,
  sleepTimerRemaining,
  onSetSleepTimer,
  className,
}: PlayerQuickControlsProps) {
  const [menu, setMenu] = useState<QuickMenu>('main');

  if (!isOpen) return null;

  const handleBack = () => {
    if (menu === 'main') {
      onClose();
    } else {
      setMenu('main');
    }
  };

  const renderMenu = () => {
    switch (menu) {
      case 'quality':
        return (
          <MenuList title="Qualidade" onBack={handleBack}>
            <MenuItem 
              label="Automático" 
              selected={currentQuality === -1}
              onClick={() => { onQualityChange(-1); setMenu('main'); }}
            />
            {qualities.map((q) => (
              <MenuItem
                key={q.index}
                label={q.label}
                sublabel={`${Math.round(q.bitrate / 1000)} kbps`}
                selected={currentQuality === q.index}
                onClick={() => { onQualityChange(q.index); setMenu('main'); }}
              />
            ))}
          </MenuList>
        );

      case 'speed':
        return (
          <MenuList title="Velocidade" onBack={handleBack}>
            {SPEEDS.map((speed) => (
              <MenuItem
                key={speed}
                label={speed === 1 ? 'Normal' : `${speed}x`}
                selected={currentSpeed === speed}
                onClick={() => { onSpeedChange(speed); setMenu('main'); }}
              />
            ))}
          </MenuList>
        );

      case 'audio':
        return (
          <MenuList title="Áudio" onBack={handleBack}>
            {audioTracks.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted-foreground">
                Nenhuma faixa de áudio alternativa
              </div>
            ) : (
              audioTracks.map((track) => (
                <MenuItem
                  key={track.id}
                  label={track.name}
                  sublabel={track.lang}
                  selected={currentAudioTrack === track.id}
                  onClick={() => { onAudioChange(track.id); setMenu('main'); }}
                />
              ))
            )}
          </MenuList>
        );

      case 'subtitles':
        return (
          <MenuList title="Legendas" onBack={handleBack}>
            <MenuItem 
              label="Desativado" 
              selected={currentSubtitle === -1}
              onClick={() => { onSubtitleDisable(); setMenu('main'); }}
            />
            {subtitleTracks.map((track) => (
              <MenuItem
                key={track.id}
                label={track.name}
                sublabel={track.lang}
                selected={currentSubtitle === track.id}
                onClick={() => { onSubtitleChange(track.id); setMenu('main'); }}
              />
            ))}
          </MenuList>
        );

      case 'aspect':
        return (
          <MenuList title="Proporção" onBack={handleBack}>
            {ASPECTS.map((aspect) => (
              <MenuItem
                key={aspect.value}
                label={aspect.label}
                selected={currentAspect === aspect.value}
                onClick={() => { onAspectChange(aspect.value); setMenu('main'); }}
              />
            ))}
          </MenuList>
        );

      case 'timer':
        return (
          <MenuList title="Timer" onBack={handleBack}>
            {TIMER_OPTIONS.map((opt) => (
              <MenuItem
                key={opt.value ?? 'off'}
                label={opt.label}
                selected={sleepTimerRemaining !== null && opt.value !== null}
                onClick={() => { onSetSleepTimer(opt.value); setMenu('main'); }}
              />
            ))}
            {sleepTimerRemaining !== null && (
              <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border mt-2">
                ⏱️ Restam {sleepTimerRemaining} minutos
              </div>
            )}
          </MenuList>
        );

      case 'stats':
        return (
          <MenuList title="Estatísticas" onBack={handleBack}>
            <div className="p-4 space-y-3">
              <StatRow label="Resolução" value={stats.resolution} />
              <StatRow label="Bitrate" value={`${Math.round(stats.bitrate / 1000)} kbps`} />
              <StatRow label="FPS" value={stats.fps.toString()} />
              <StatRow label="Buffer" value={`${stats.bufferLength.toFixed(1)}s`} />
              <StatRow label="Frames Perdidos" value={stats.droppedFrames.toString()} />
              <StatRow label="Latência" value={`${stats.latency}ms`} />
              <StatRow label="Codec" value={stats.codec} />
            </div>
          </MenuList>
        );

      default:
        return (
          <div className="space-y-1">
            {/* Quality */}
            <MainMenuItem
              icon={<Monitor className="w-4 h-4" />}
              label="Qualidade"
              value={currentQuality === -1 ? 'Auto' : qualities.find(q => q.index === currentQuality)?.label || 'Auto'}
              onClick={() => setMenu('quality')}
            />
            
            {/* Speed */}
            <MainMenuItem
              icon={<Gauge className="w-4 h-4" />}
              label="Velocidade"
              value={currentSpeed === 1 ? 'Normal' : `${currentSpeed}x`}
              onClick={() => setMenu('speed')}
            />

            {/* Audio */}
            {audioTracks.length > 1 && (
              <MainMenuItem
                icon={<Languages className="w-4 h-4" />}
                label="Áudio"
                value={audioTracks.find(t => t.id === currentAudioTrack)?.name || 'Padrão'}
                onClick={() => setMenu('audio')}
              />
            )}

            {/* Subtitles */}
            <MainMenuItem
              icon={<Type className="w-4 h-4" />}
              label="Legendas"
              value={currentSubtitle === -1 ? 'Desativado' : subtitleTracks.find(t => t.id === currentSubtitle)?.name || 'Ativado'}
              onClick={() => setMenu('subtitles')}
            />

            {/* Aspect Ratio */}
            <MainMenuItem
              icon={<Monitor className="w-4 h-4" />}
              label="Proporção"
              value={ASPECTS.find(a => a.value === currentAspect)?.label || 'Auto'}
              onClick={() => setMenu('aspect')}
            />

            {/* PiP */}
            {isPipSupported && (
              <MainMenuItem
                icon={<PictureInPicture className="w-4 h-4" />}
                label="Picture-in-Picture"
                value={isPipActive ? 'Ativo' : 'Desativado'}
                onClick={onTogglePip}
              />
            )}

            {/* Timer */}
            <MainMenuItem
              icon={<Timer className="w-4 h-4" />}
              label="Timer"
              value={sleepTimerRemaining !== null ? `${sleepTimerRemaining} min` : 'Desligado'}
              onClick={() => setMenu('timer')}
            />

            {/* Stats */}
            <MainMenuItem
              icon={<BarChart3 className="w-4 h-4" />}
              label="Estatísticas"
              value={showStats ? 'Visível' : 'Oculto'}
              onClick={() => setMenu('stats')}
            />
          </div>
        );
    }
  };

  return (
    <div 
      className={cn(
        'absolute bottom-20 right-4 w-72 max-h-80',
        'bg-background/95 backdrop-blur-xl rounded-lg border border-border shadow-xl',
        'z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200',
        className
      )}
    >
      {renderMenu()}
    </div>
  );
}

// Helper components
function MenuList({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div>
      <button 
        onClick={onBack}
        className="w-full flex items-center gap-2 p-3 border-b border-border hover:bg-muted/50"
      >
        <ChevronLeft className="w-4 h-4" />
        <span className="font-medium">{title}</span>
      </button>
      <div className="max-h-60 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

function MenuItem({ label, sublabel, selected, onClick }: { 
  label: string; 
  sublabel?: string; 
  selected: boolean; 
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors',
        selected && 'bg-primary/10'
      )}
    >
      <div>
        <div className="text-sm">{label}</div>
        {sublabel && <div className="text-xs text-muted-foreground">{sublabel}</div>}
      </div>
      {selected && <Check className="w-4 h-4 text-primary" />}
    </button>
  );
}

function MainMenuItem({ icon, label, value, onClick }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-sm text-muted-foreground">{value}</span>
    </button>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

export default PlayerQuickControls;
