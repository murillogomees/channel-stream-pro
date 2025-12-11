/**
 * Download Priority Service
 * Pausa downloads de VOD quando o player está ativo para priorizar performance
 */

import { supabase } from '@/lib/supabase';

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
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) return;

      const response = await supabase.functions.invoke('download-vod', {
        body: { pauseAll: true },
        headers: { Authorization: `Bearer ${session.session.access_token}` },
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
        const { data: session } = await supabase.auth.getSession();
        if (!session?.session) return;

        const response = await supabase.functions.invoke('download-vod', {
          body: { resumeAll: true },
          headers: { Authorization: `Bearer ${session.session.access_token}` },
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
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session) return false;

    const response = await supabase.functions.invoke('download-vod', {
      body: { resumeAll: true },
      headers: { Authorization: `Bearer ${session.session.access_token}` },
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
