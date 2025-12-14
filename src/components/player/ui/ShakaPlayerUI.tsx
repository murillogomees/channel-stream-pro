/**
 * ShakaPlayerUI - White-label IPTV Player UI
 * 
 * Features:
 * - Enterprise-grade Shaka Player engine
 * - Quality selector
 * - TV remote support
 * - Fully customizable branding
 */

import React, { useEffect, useCallback, useState } from 'react'
import { useShakaPlayer, QualityLevel } from '../hooks/useShakaPlayer'
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, 
  Loader2, WifiOff, RefreshCw, Settings, ChevronUp, ArrowLeft
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BrandConfig {
  name?: string
  logo?: string
  primaryColor?: string
  secondaryColor?: string
  accentColor?: string
  fontFamily?: string
}

export interface ShakaPlayerUIProps {
  streamUrl: string
  title?: string
  subtitle?: string
  brand?: BrandConfig
  className?: string
  onBack?: () => void
  onError?: (message: string) => void
}

export function ShakaPlayerUI({
  streamUrl,
  title,
  subtitle,
  brand,
  className,
  onBack,
  onError
}: ShakaPlayerUIProps) {
  const {
    videoRef,
    containerRef,
    state,
    error,
    isRecovering,
    currentTime,
    duration,
    volume,
    isMuted,
    isFullscreen,
    bufferLevel,
    qualityLevels,
    currentQuality,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    toggleFullscreen,
    selectQuality,
    reload,
    loadSource
  } = useShakaPlayer()

  const [showControls, setShowControls] = useState(true)
  const [showQualityMenu, setShowQualityMenu] = useState(false)
  const controlsTimeoutRef = React.useRef<NodeJS.Timeout>()

  // Load source on mount
  useEffect(() => {
    if (streamUrl) {
      loadSource(streamUrl)
    }
  }, [streamUrl, loadSource])

  // Report errors
  useEffect(() => {
    if (error && onError) {
      onError(error.message)
    }
  }, [error, onError])

  // Auto-hide controls
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true)
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (state === 'playing') {
        setShowControls(false)
        setShowQualityMenu(false)
      }
    }, 3000)
  }, [state])

  useEffect(() => {
    resetControlsTimeout()
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
    }
  }, [resetControlsTimeout])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    resetControlsTimeout()
    
    switch (e.key) {
      case ' ':
      case 'Enter':
        e.preventDefault()
        togglePlay()
        break
      case 'ArrowLeft':
        seek(Math.max(0, currentTime - 10))
        break
      case 'ArrowRight':
        seek(Math.min(duration, currentTime + 10))
        break
      case 'ArrowUp':
        setVolume(Math.min(1, volume + 0.1))
        break
      case 'ArrowDown':
        setVolume(Math.max(0, volume - 0.1))
        break
      case 'm':
        toggleMute()
        break
      case 'f':
        toggleFullscreen()
        break
      case 'Escape':
        if (showQualityMenu) {
          setShowQualityMenu(false)
        } else {
          onBack?.()
        }
        break
    }
  }, [togglePlay, seek, currentTime, duration, volume, setVolume, toggleMute, toggleFullscreen, onBack, showQualityMenu, resetControlsTimeout])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || isNaN(seconds)) return '--:--'
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  // Overlay states
  const showLoading = state === 'loading' || state === 'buffering'
  const showRecovering = isRecovering
  const showError = state === 'error' && error

  const primaryColor = brand?.primaryColor || 'hsl(var(--primary))'
  const accentColor = brand?.accentColor || 'hsl(var(--accent))'

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative w-full h-full bg-black overflow-hidden select-none",
        className
      )}
      style={{ fontFamily: brand?.fontFamily || 'system-ui, sans-serif' }}
      tabIndex={0}
      onMouseMove={resetControlsTimeout}
      onTouchStart={resetControlsTimeout}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        autoPlay
      />

      {/* Loading Overlay */}
      {showLoading && !showRecovering && !showError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <span className="text-white/80 text-sm">Carregando...</span>
          </div>
        </div>
      )}

      {/* Recovering Overlay */}
      {showRecovering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10">
          <div className="flex flex-col items-center gap-3 px-6 py-4 rounded-lg bg-black/60 backdrop-blur-sm">
            <RefreshCw className="w-8 h-8 animate-spin text-accent" />
            <span className="text-white/90 text-sm">Reconectando...</span>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {showError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
          <div className="flex flex-col items-center gap-4 max-w-sm text-center px-6">
            {/* Check if it's a 403/provider block error */}
            {error?.message?.includes('403') || error?.message?.includes('UPSTREAM_ERROR') || error?.message?.includes('access denied') ? (
              <>
                <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <WifiOff className="w-10 h-10 text-orange-400" />
                </div>
                <h3 className="text-white text-xl font-semibold">
                  Canal Indisponível
                </h3>
                <p className="text-white/70 text-sm">
                  O servidor do provedor bloqueou o acesso a este canal.
                  Isso pode ser temporário ou uma restrição do serviço.
                </p>
                <div className="flex flex-col gap-2 w-full">
                  <button
                    onClick={reload}
                    className="w-full px-6 py-2 rounded-lg bg-orange-500 text-white font-medium transition-colors hover:bg-orange-600"
                  >
                    Tentar Novamente
                  </button>
                  {onBack && (
                    <button
                      onClick={onBack}
                      className="w-full px-4 py-2 rounded-lg bg-white/10 text-white/80 hover:bg-white/20 text-sm"
                    >
                      Voltar e Escolher Outro Canal
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <WifiOff className="w-16 h-16 text-destructive" />
                <h3 className="text-white text-xl font-semibold">
                  Erro de Reprodução
                </h3>
                <p className="text-white/70 text-sm">
                  {error?.message || 'Não foi possível reproduzir o conteúdo'}
                </p>
                <button
                  onClick={reload}
                  className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium transition-colors hover:bg-primary/90"
                >
                  Tentar Novamente
                </button>
                {onBack && (
                  <button
                    onClick={onBack}
                    className="px-4 py-2 text-white/60 hover:text-white text-sm"
                  >
                    Voltar
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Top Bar */}
      <div 
        className={cn(
          "absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 z-30",
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
          )}
          <div className="flex-1">
            {brand?.logo && (
              <img src={brand.logo} alt={brand.name} className="h-8 w-auto mb-1" />
            )}
            {title && (
              <h2 className="text-white text-lg font-medium truncate">{title}</h2>
            )}
            {subtitle && (
              <p className="text-white/60 text-sm truncate">{subtitle}</p>
            )}
          </div>
          
          {/* Buffer indicator */}
          {bufferLevel > 0 && (
            <div className="text-white/50 text-xs">
              Buffer: {bufferLevel.toFixed(1)}s
            </div>
          )}
        </div>
      </div>

      {/* Bottom Controls */}
      <div 
        className={cn(
          "absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300 z-30",
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Progress bar */}
        {duration > 0 && (
          <div className="mb-3">
            <div 
              className="h-1.5 bg-white/20 rounded-full cursor-pointer group/progress hover:h-2 transition-all"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const percent = (e.clientX - rect.left) / rect.width
                seek(percent * duration)
              }}
            >
              <div 
                className="h-full rounded-full bg-primary relative transition-all"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary opacity-0 group-hover/progress:opacity-100 transition-opacity" />
              </div>
            </div>
            <div className="flex justify-between text-white/60 text-xs mt-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        )}

        {/* Control buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {state === 'playing' ? (
                <Pause className="w-6 h-6 text-white" />
              ) : (
                <Play className="w-6 h-6 text-white ml-0.5" />
              )}
            </button>

            {/* Volume */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5 text-white" />
                ) : (
                  <Volume2 className="w-5 h-5 text-white" />
                )}
              </button>
              
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-24 h-1 bg-white/20 rounded-full appearance-none cursor-pointer hidden sm:block accent-primary"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quality selector */}
            {qualityLevels.length > 1 && (
              <div className="relative">
                <button
                  onClick={() => setShowQualityMenu(!showQualityMenu)}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <Settings className="w-5 h-5 text-white" />
                </button>

                {showQualityMenu && (
                  <div className="absolute bottom-full right-0 mb-2 bg-black/90 rounded-lg p-2 min-w-32 backdrop-blur-sm">
                    <div className="text-white/60 text-xs px-2 py-1 mb-1">Qualidade</div>
                    {qualityLevels.map((level, index) => (
                      <button
                        key={level.height}
                        onClick={() => {
                          selectQuality(index)
                          setShowQualityMenu(false)
                        }}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded text-sm transition-colors",
                          currentQuality === index 
                            ? "bg-primary text-primary-foreground" 
                            : "text-white hover:bg-white/10"
                        )}
                      >
                        {level.label}
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        selectQuality(-1)
                        setShowQualityMenu(false)
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded text-sm transition-colors",
                        currentQuality === -1 
                          ? "bg-primary text-primary-foreground" 
                          : "text-white hover:bg-white/10"
                      )}
                    >
                      Auto
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              {isFullscreen ? (
                <Minimize className="w-5 h-5 text-white" />
              ) : (
                <Maximize className="w-5 h-5 text-white" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Touch overlay */}
      <div 
        className="absolute inset-0 z-0"
        onClick={() => {
          if (showControls) {
            togglePlay()
          } else {
            resetControlsTimeout()
          }
        }}
      />
    </div>
  )
}

export default ShakaPlayerUI
