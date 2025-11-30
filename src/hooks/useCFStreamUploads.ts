/**
 * useCFStreamUploads - Hook para gerenciar uploads do Cloudflare Stream
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Upload {
  id: string;
  channel_id: string;
  original_url: string;
  cf_stream_uid: string | null;
  status: string;
  progress_percent: number;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  channel_name?: string;
}

interface StatusCounts {
  queued: number;
  downloading: number;
  processing: number;
  ready: number;
  failed: number;
  retry_scheduled: number;
}

export function useCFStreamUploads() {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [counts, setCounts] = useState<StatusCounts>({
    queued: 0,
    downloading: 0,
    processing: 0,
    ready: 0,
    failed: 0,
    retry_scheduled: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUploads = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch uploads with channel info
      const { data: uploadsData, error: uploadsError } = await supabase
        .from("cf_stream_uploads")
        .select(`
          *,
          m3u_channels!cf_stream_uploads_channel_id_fkey (
            name
          )
        `)
        .order("updated_at", { ascending: false })
        .limit(500);

      if (uploadsError) throw uploadsError;

      // Map uploads with channel names
      const mappedUploads: Upload[] = (uploadsData || []).map((upload: any) => ({
        ...upload,
        channel_name: upload.m3u_channels?.name || null,
      }));

      setUploads(mappedUploads);

      // Calculate counts
      const newCounts: StatusCounts = {
        queued: 0,
        downloading: 0,
        processing: 0,
        ready: 0,
        failed: 0,
        retry_scheduled: 0,
      };

      mappedUploads.forEach((upload) => {
        if (upload.status in newCounts) {
          newCounts[upload.status as keyof StatusCounts]++;
        }
      });

      setCounts(newCounts);
    } catch (err: any) {
      console.error("Error fetching uploads:", err);
      setError(err.message);
      toast.error("Erro ao carregar uploads", { description: err.message });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const retryUpload = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from("cf_stream_uploads")
        .update({
          status: "queued",
          error_message: null,
          retry_count: 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;

      toast.success("Upload recolocado na fila");
      await fetchUploads();
    } catch (err: any) {
      toast.error("Erro ao reprocessar upload", { description: err.message });
      throw err;
    }
  }, [fetchUploads]);

  const cancelUpload = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from("cf_stream_uploads")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Upload removido");
      await fetchUploads();
    } catch (err: any) {
      toast.error("Erro ao remover upload", { description: err.message });
      throw err;
    }
  }, [fetchUploads]);

  // Initial fetch
  useEffect(() => {
    fetchUploads();
  }, [fetchUploads]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel("cf_stream_uploads_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cf_stream_uploads",
        },
        (payload) => {
          // Refresh on any change
          fetchUploads();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchUploads]);

  return {
    uploads,
    counts,
    isLoading,
    error,
    refresh: fetchUploads,
    retryUpload,
    cancelUpload,
  };
}
