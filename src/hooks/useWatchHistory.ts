/**
 * useWatchHistory - Hook para gerenciar histórico de visualização
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface WatchHistoryItem {
  id: string;
  profile_id: string;
  content_id: string;
  content_type: string;
  content_name: string;
  content_logo: string | null;
  content_category: string | null;
  metadata: Record<string, any> | null;
  watched_at: string;
  duration_seconds: number;
  created_at: string;
  last_watched_at: string;
  progress_percent?: number;
}

interface AddToHistoryInput {
  content_id: string;
  content_type: string;
  content_name: string;
  content_logo?: string;
  content_category?: string;
  duration_seconds?: number;
  metadata?: Record<string, any>;
}

export function useWatchHistory(profileId: string | null) {
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);
  const [continueWatching, setContinueWatching] = useState<WatchHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch watch history
  const fetchHistory = useCallback(async () => {
    if (!profileId) {
      setHistory([]);
      setContinueWatching([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("watch_history")
        .select("*")
        .eq("profile_id", profileId)
        .order("last_watched_at", { ascending: false })
        .limit(100);

      if (fetchError) throw fetchError;

      const items: WatchHistoryItem[] = (data || []).map(item => {
        const meta = item.metadata as Record<string, any> | null;
        return {
          ...item,
          metadata: meta,
          // Calculate progress based on metadata if available
          progress_percent: meta?.progress_percent || 
            (meta?.total_duration && item.duration_seconds
              ? Math.min(100, (item.duration_seconds / meta.total_duration) * 100)
              : undefined),
        };
      });

      setHistory(items);

      // Continue watching = items with progress < 90%
      const continueItems = items.filter(item => 
        item.progress_percent !== undefined && 
        item.progress_percent > 5 && 
        item.progress_percent < 90
      ).slice(0, 10);

      setContinueWatching(continueItems);
    } catch (err: any) {
      console.error("Error fetching watch history:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [profileId]);

  // Add or update watch history
  const addToHistory = useCallback(async (input: AddToHistoryInput): Promise<boolean> => {
    if (!profileId) return false;

    try {
      // Check if entry exists
      const { data: existing } = await supabase
        .from("watch_history")
        .select("id, duration_seconds, metadata")
        .eq("profile_id", profileId)
        .eq("content_id", input.content_id)
        .single();

      if (existing) {
        // Update existing entry
        const newDuration = Math.max(existing.duration_seconds || 0, input.duration_seconds || 0);
        
        const { error: updateError } = await supabase
          .from("watch_history")
          .update({
            duration_seconds: newDuration,
            last_watched_at: new Date().toISOString(),
            metadata: {
              ...(existing.metadata as Record<string, any> || {}),
              ...input.metadata,
            },
          })
          .eq("id", existing.id);

        if (updateError) throw updateError;
      } else {
        // Create new entry
        const { error: insertError } = await supabase
          .from("watch_history")
          .insert({
            profile_id: profileId,
            content_id: input.content_id,
            content_type: input.content_type,
            content_name: input.content_name,
            content_logo: input.content_logo || null,
            content_category: input.content_category || null,
            duration_seconds: input.duration_seconds || 0,
            metadata: input.metadata || {},
            watched_at: new Date().toISOString(),
            last_watched_at: new Date().toISOString(),
          });

        if (insertError) throw insertError;
      }

      await fetchHistory();
      return true;
    } catch (err: any) {
      console.error("Error adding to watch history:", err);
      return false;
    }
  }, [profileId, fetchHistory]);

  // Update progress for a specific item
  const updateProgress = useCallback(async (
    contentId: string, 
    progressSeconds: number,
    totalDuration?: number
  ): Promise<boolean> => {
    if (!profileId) return false;

    try {
      const progressPercent = totalDuration 
        ? Math.min(100, (progressSeconds / totalDuration) * 100)
        : undefined;

      const { error: updateError } = await supabase
        .from("watch_history")
        .update({
          duration_seconds: progressSeconds,
          last_watched_at: new Date().toISOString(),
          metadata: {
            progress_percent: progressPercent,
            total_duration: totalDuration,
            last_position: progressSeconds,
          },
        })
        .eq("profile_id", profileId)
        .eq("content_id", contentId);

      if (updateError) throw updateError;

      // Update local state without refetch
      setHistory(prev => prev.map(item => 
        item.content_id === contentId 
          ? { ...item, duration_seconds: progressSeconds, progress_percent: progressPercent }
          : item
      ));

      return true;
    } catch (err: any) {
      console.error("Error updating progress:", err);
      return false;
    }
  }, [profileId]);

  // Remove from history
  const removeFromHistory = useCallback(async (contentId: string): Promise<boolean> => {
    if (!profileId) return false;

    try {
      const { error: deleteError } = await supabase
        .from("watch_history")
        .delete()
        .eq("profile_id", profileId)
        .eq("content_id", contentId);

      if (deleteError) throw deleteError;

      setHistory(prev => prev.filter(item => item.content_id !== contentId));
      setContinueWatching(prev => prev.filter(item => item.content_id !== contentId));

      toast.success("Removido do histórico");
      return true;
    } catch (err: any) {
      console.error("Error removing from history:", err);
      toast.error("Erro ao remover do histórico");
      return false;
    }
  }, [profileId]);

  // Clear all history
  const clearHistory = useCallback(async (): Promise<boolean> => {
    if (!profileId) return false;

    try {
      const { error: deleteError } = await supabase
        .from("watch_history")
        .delete()
        .eq("profile_id", profileId);

      if (deleteError) throw deleteError;

      setHistory([]);
      setContinueWatching([]);

      toast.success("Histórico limpo");
      return true;
    } catch (err: any) {
      console.error("Error clearing history:", err);
      toast.error("Erro ao limpar histórico");
      return false;
    }
  }, [profileId]);

  // Initial fetch
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return {
    history,
    continueWatching,
    isLoading,
    error,
    addToHistory,
    updateProgress,
    removeFromHistory,
    clearHistory,
    refresh: fetchHistory,
  };
}
