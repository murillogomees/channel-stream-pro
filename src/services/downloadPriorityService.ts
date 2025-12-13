/**
 * Download Priority Service
 * Pausa downloads de VOD quando o player está ativo para priorizar performance
 * 
 * USES CUSTOM AUTH - GoTrue removed
 */

import { supabase } from '@/integrations/supabase/client';
import { authCache } from './authCacheService';

let playerActiveCount = 0;
let isPaused = false;

/**
 * Chama quando um player é aberto
 * Pausa todos os downloads se for o primeiro player
 */
export async function onPlayerOpen(): Promise<void> {
  playerActiveCount++;
  
  if (playerActiveCount === 1 && !isPaused) {
    try {
      const token = authCache.getAccessToken();
      if (!token) return;

      const response = await supabase.functions.invoke('download-vod', {
        body: { pauseAll: true },
        headers: { 
          'Authorization': `Bearer ${token}`,
          'X-Custom-Token': token,
        },
      });

      if (!response.error) {
        isPaused = true;
        console.log('⏸️ [Priority] Downloads pausados para prioridade do player');
      }
    } catch (error) {
      console.warn('[Priority] Erro ao pausar downloads:', error);
    }
  }
}

/**
 * Chama quando um player é fechado
 * Retoma downloads se todos os players foram fechados
 */
export async function onPlayerClose(): Promise<void> {
  playerActiveCount = Math.max(0, playerActiveCount - 1);
  
  if (playerActiveCount === 0 && isPaused) {
    // Esperar 2 segundos para garantir que o player realmente fechou
    setTimeout(async () => {
      if (playerActiveCount > 0) return; // Outro player abriu
      
      try {
        const token = authCache.getAccessToken();
        if (!token) return;

        const response = await supabase.functions.invoke('download-vod', {
          body: { resumeAll: true },
          headers: { 
            'Authorization': `Bearer ${token}`,
            'X-Custom-Token': token,
          },
        });

        if (!response.error) {
          isPaused = false;
          console.log('▶️ [Priority] Downloads retomados');
        }
      } catch (error) {
        console.warn('[Priority] Erro ao retomar downloads:', error);
      }
    }, 2000);
  }
}

/**
 * Retorna se há players ativos
 */
export function isPlayerActive(): boolean {
  return playerActiveCount > 0;
}

/**
 * Retorna se downloads estão pausados
 */
export function areDownloadsPaused(): boolean {
  return isPaused;
}

/**
 * Força retomada de downloads (para uso manual)
 */
export async function forceResumeDownloads(): Promise<boolean> {
  try {
    const token = authCache.getAccessToken();
    if (!token) return false;

    const response = await supabase.functions.invoke('download-vod', {
      body: { resumeAll: true },
      headers: { 
        'Authorization': `Bearer ${token}`,
        'X-Custom-Token': token,
      },
    });

    if (!response.error) {
      isPaused = false;
      playerActiveCount = 0;
      return true;
    }
    return false;
  } catch (error) {
    console.error('[Priority] Erro ao forçar retomada:', error);
    return false;
  }
}
