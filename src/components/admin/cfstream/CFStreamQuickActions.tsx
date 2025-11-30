/**
 * CFStreamQuickActions - Ações rápidas para gerenciamento de uploads
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Play, 
  Pause, 
  RefreshCw, 
  Trash2, 
  AlertTriangle,
  Loader2,
  Zap,
  Clock
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface CFStreamQuickActionsProps {
  onRefresh: () => void;
  counts: {
    queued: number;
    failed: number;
    retry_scheduled: number;
  };
}

export function CFStreamQuickActions({ onRefresh, counts }: CFStreamQuickActionsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: string;
    title: string;
    description: string;
    onConfirm: () => Promise<void>;
  }>({ open: false, action: "", title: "", description: "", onConfirm: async () => {} });

  const triggerScheduler = async () => {
    setLoading("trigger");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada");
        return;
      }

      const response = await supabase.functions.invoke("cf-stream-scheduler", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast.success("Scheduler executado com sucesso", {
        description: `${response.data?.newUploads || 0} novos uploads iniciados`,
      });
      onRefresh();
    } catch (error: any) {
      toast.error("Erro ao executar scheduler", {
        description: error.message,
      });
    } finally {
      setLoading(null);
    }
  };

  const retryAllFailed = async () => {
    setLoading("retry");
    try {
      const { error } = await supabase
        .from("cf_stream_uploads")
        .update({ 
          status: "queued", 
          retry_count: 0,
          error_message: null,
          updated_at: new Date().toISOString()
        })
        .in("status", ["failed", "retry_scheduled"]);

      if (error) throw error;

      toast.success("Uploads recolocados na fila", {
        description: `${counts.failed + counts.retry_scheduled} uploads serão reprocessados`,
      });
      onRefresh();
    } catch (error: any) {
      toast.error("Erro ao reprocessar uploads", {
        description: error.message,
      });
    } finally {
      setLoading(null);
      setConfirmDialog({ ...confirmDialog, open: false });
    }
  };

  const clearQueue = async () => {
    setLoading("clear");
    try {
      const { error } = await supabase
        .from("cf_stream_uploads")
        .delete()
        .eq("status", "queued");

      if (error) throw error;

      toast.success("Fila limpa", {
        description: `${counts.queued} uploads removidos da fila`,
      });
      onRefresh();
    } catch (error: any) {
      toast.error("Erro ao limpar fila", {
        description: error.message,
      });
    } finally {
      setLoading(null);
      setConfirmDialog({ ...confirmDialog, open: false });
    }
  };

  const clearFailed = async () => {
    setLoading("clearFailed");
    try {
      const { error } = await supabase
        .from("cf_stream_uploads")
        .delete()
        .eq("status", "failed");

      if (error) throw error;

      toast.success("Uploads com falha removidos", {
        description: `${counts.failed} uploads removidos`,
      });
      onRefresh();
    } catch (error: any) {
      toast.error("Erro ao remover uploads", {
        description: error.message,
      });
    } finally {
      setLoading(null);
      setConfirmDialog({ ...confirmDialog, open: false });
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            Ações Rápidas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Trigger Scheduler */}
          <Button 
            variant="default" 
            className="w-full justify-start gap-2"
            onClick={triggerScheduler}
            disabled={loading === "trigger"}
          >
            {loading === "trigger" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Executar Scheduler Agora
          </Button>

          {/* Retry All Failed */}
          <Button 
            variant="outline" 
            className="w-full justify-start gap-2"
            onClick={() => setConfirmDialog({
              open: true,
              action: "retry",
              title: "Reprocessar todos os uploads com falha?",
              description: `${counts.failed + counts.retry_scheduled} uploads serão recolocados na fila para processamento.`,
              onConfirm: retryAllFailed,
            })}
            disabled={loading === "retry" || (counts.failed + counts.retry_scheduled) === 0}
          >
            {loading === "retry" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Reprocessar Falhos ({counts.failed + counts.retry_scheduled})
          </Button>

          {/* Clear Queue */}
          <Button 
            variant="outline" 
            className="w-full justify-start gap-2 text-orange-500 hover:text-orange-600"
            onClick={() => setConfirmDialog({
              open: true,
              action: "clear",
              title: "Limpar fila de uploads?",
              description: `${counts.queued} uploads na fila serão removidos. Esta ação não pode ser desfeita.`,
              onConfirm: clearQueue,
            })}
            disabled={loading === "clear" || counts.queued === 0}
          >
            {loading === "clear" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Clock className="h-4 w-4" />
            )}
            Limpar Fila ({counts.queued})
          </Button>

          {/* Clear Failed */}
          <Button 
            variant="outline" 
            className="w-full justify-start gap-2 text-destructive hover:text-destructive"
            onClick={() => setConfirmDialog({
              open: true,
              action: "clearFailed",
              title: "Remover uploads com falha?",
              description: `${counts.failed} uploads com falha serão permanentemente removidos. Esta ação não pode ser desfeita.`,
              onConfirm: clearFailed,
            })}
            disabled={loading === "clearFailed" || counts.failed === 0}
          >
            {loading === "clearFailed" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Remover Falhos ({counts.failed})
          </Button>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              {confirmDialog.title}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDialog.onConfirm}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
