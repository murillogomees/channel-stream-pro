/**
 * IPTVPlayerWhiteLabel - Player IPTV Modular White-Label
 * 
 * Features:
 * - Totalmente customizável (cores, logo, fonte)
 * - UI silenciosa durante recovery
 * - Controles mínimos + responsivos
 * - Suporte a TV remote
 * - Sem dependência de players prontos
 */

import React, { useEffect, useCallback } from 'react'
import { useIPTVPlayer } from '../hooks/useIPTVPlayer'
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Loader2, WifiOff, RefreshCw, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BrandConfig {
  name?: string
  logo?: string
  primaryColor?: string
  secondaryColor?: string
  accentColor?: string
  fontFamily?: string
}

export interface IPTVPlayerWhiteLabelProps {
  streamUrl: string
  title?: string
  brand?: BrandConfig
  className?: string
  userId?: string
  contentId?: string
  onBack?: () => void
  onError?: (message: string) => void
}

export function IPTVPlayerWhiteLabel({
  streamUrl,
  title,
  brand,
  className,
  userId,
  contentId,
  onBack,
  onError
}: IPTVPlayerWhiteLabelProps) {
  const {
    videoRef,
    containerRef,
    state,
    error,
    isRecovering,
    recoveryAttempt,
    currentTime,
    duration,
    volume,
    isMuted,
    isFullscreen,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    toggleFullscreen,
    reload,
    loadSource
  } = useIPTVPlayer({ userId, contentId })

  // Load source on mount or URL change
  useEffect(() => {
    if (streamUrl) {
      loadSource(streamUrl)
    }
  }, [streamUrl, loadSource])

  // Report errors to parent
  useEffect(() => {
    if (error && onError) {
      onError(error.message)
    }
  }, [error, onError])

  // Keyboard navigation (TV remote support)
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
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
        onBack?.()
        break
    }
  }, [togglePlay, seek, currentTime, duration, volume, setVolume, toggleMute, toggleFullscreen, onBack])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || isNaN(seconds)) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  // Determine overlay states
  const showLoading = state === 'loading' || state === 'initializing' || state === 'buffering'
  const showRecovering = isRecovering
  const showError = state === 'error' && error

  const primaryColor = brand?.primaryColor || '#3b82f6'
  const accentColor = brand?.accentColor || '#60a5fa'

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative w-full h-full bg-black overflow-hidden group select-none",
        className
      )}
      style={{ fontFamily: brand?.fontFamily || 'system-ui, sans-serif' }}
      tabIndex={0}
    >
      {/* Video Element - NEVER set src directly */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        autoPlay
      />

      {/* Loading Overlay */}
      {showLoading && !showRecovering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
          <div className="flex flex-col items-center gap-4">
            <Loader2 
              className="w-12 h-12 animate-spin" 
              style={{ color: primaryColor }}
            />
            <span className="text-white/80 text-sm">Carregando...</span>
          </div>
        </div>
      )}

      {/* Recovering Overlay - Silent, minimal */}
      {showRecovering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10">
          <div className="flex flex-col items-center gap-3 px-6 py-4 rounded-lg bg-black/60 backdrop-blur-sm">
            <RefreshCw 
              className="w-8 h-8 animate-spin" 
              style={{ color: accentColor }}
            />
            <span className="text-white/90 text-sm">
              Reconectando... ({recoveryAttempt}/3)
            </span>
          </div>
        </div>
      )}

      {/* Error Overlay - Human friendly */}
      {showError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
          <div className="flex flex-col items-center gap-4 max-w-sm text-center px-6">
            <WifiOff className="w-16 h-16 text-red-400" />
            <h3 className="text-white text-xl font-semibold">
              {error.type === 'AUTH_EXPIRED' || error.type === 'AUTH_FORBIDDEN'
                ? 'Sessão Expirada' 
                : 'Erro de Conexão'}
            </h3>
            <p className="text-white/70 text-sm">
              {error.message}
            </p>
            <button
              onClick={reload}
              className="px-6 py-2 rounded-lg text-white font-medium transition-colors hover:opacity-90"
              style={{ backgroundColor: primaryColor }}
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
          </div>
        </div>
      )}

      {/* Title & Brand (top) */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/60 to-transparent opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity z-5">
        <div className="flex items-center gap-3">
          {brand?.logo && (
            <img src={brand.logo} alt={brand.name} className="h-8 w-auto" />
          )}
          {title && (
            <h2 className="text-white text-lg font-medium truncate">{title}</h2>
          )}
        </div>
      </div>

      {/* Controls (bottom) */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity z-5">
        {/* Progress bar */}
        <div className="mb-3">
          <div 
            className="h-1 bg-white/20 rounded-full cursor-pointer group/progress"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const percent = (e.clientX - rect.left) / rect.width
              seek(percent * duration)
            }}
          >
            <div 
              className="h-full rounded-full transition-all relative"
              style={{ 
                width: `${progress}%`,
                backgroundColor: primaryColor
              }}
            >
              <div 
                className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity"
                style={{ backgroundColor: primaryColor }}
              />
            </div>
          </div>
          <div className="flex justify-between text-white/60 text-xs mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Control buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
              aria-label={state === 'playing' ? 'Pausar' : 'Play'}
            >
              {state === 'playing' ? (
                <Pause className="w-5 h-5 text-white" />
              ) : (
                <Play className="w-5 h-5 text-white ml-0.5" />
              )}
            </button>

            {/* Volume */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
                aria-label={isMuted ? 'Ativar som' : 'Mudo'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5 text-white" />
                ) : (
                  <Volume2 className="w-5 h-5 text-white" />
                )}
              </button>
              
              {/* Volume slider */}
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-20 h-1 bg-white/20 rounded-full appearance-none cursor-pointer hidden sm:block"
                style={{
                  background: `linear-gradient(to right, ${primaryColor} ${volume * 100}%, rgba(255,255,255,0.2) ${volume * 100}%)`
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Settings placeholder */}
            <button
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
              aria-label="Configurações"
            >
              <Settings className="w-5 h-5 text-white" />
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
              aria-label={isFullscreen ? 'Sair de tela cheia' : 'Tela cheia'}
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

      {/* Touch area for mobile - tap to show controls */}
      <div 
        className="absolute inset-0 z-0"
        onClick={togglePlay}
      />
    </div>
  )
}
