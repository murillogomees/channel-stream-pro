/**
 * CFStreamUploadsList - Lista de uploads com filtros e ações
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  RefreshCw, 
  Search, 
  ExternalLink, 
  RotateCcw,
  Trash2,
  Clock,
  AlertCircle,
  CheckCircle,
  Loader2,
  Cloud,
  Play,
  Shield
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CFStreamSignedUrlDialog } from "./CFStreamSignedUrlDialog";

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

interface CFStreamUploadsListProps {
  uploads: Upload[];
  isLoading: boolean;
  onRefresh: () => void;
  onRetry: (id: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  queued: { label: "Na Fila", icon: Clock, variant: "secondary" },
  downloading: { label: "Baixando", icon: Cloud, variant: "default" },
  processing: { label: "Processando", icon: Loader2, variant: "default" },
  ready: { label: "Pronto", icon: CheckCircle, variant: "outline" },
  failed: { label: "Falhou", icon: AlertCircle, variant: "destructive" },
  retry_scheduled: { label: "Retry Agendado", icon: RefreshCw, variant: "secondary" },
};

export function CFStreamUploadsList({
  uploads,
  isLoading,
  onRefresh,
  onRetry,
  onCancel,
  statusFilter,
  onStatusFilterChange,
  searchTerm,
  onSearchChange,
}: CFStreamUploadsListProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [signedUrlDialogOpen, setSignedUrlDialogOpen] = useState(false);
  const [selectedUpload, setSelectedUpload] = useState<{ uid: string; name?: string } | null>(null);

  const handleOpenSignedUrlDialog = (cfStreamUid: string, channelName?: string) => {
    setSelectedUpload({ uid: cfStreamUid, name: channelName });
    setSignedUrlDialogOpen(true);
  };

  const handleRetry = async (id: string) => {
    setActionLoading(id);
    try {
      await onRetry(id);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (id: string) => {
    setActionLoading(id);
    try {
      await onCancel(id);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredUploads = uploads.filter((upload) => {
    const matchesStatus = statusFilter === "all" || upload.status === statusFilter;
    const matchesSearch = !searchTerm || 
      upload.original_url.toLowerCase().includes(searchTerm.toLowerCase()) ||
      upload.channel_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      upload.id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="text-lg">Uploads Cloudflare Stream</CardTitle>
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
        
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por URL ou canal..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filtrar status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="queued">Na Fila</SelectItem>
              <SelectItem value="downloading">Baixando</SelectItem>
              <SelectItem value="processing">Processando</SelectItem>
              <SelectItem value="ready">Pronto</SelectItem>
              <SelectItem value="retry_scheduled">Retry Agendado</SelectItem>
              <SelectItem value="failed">Falhou</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">URL</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Progresso</TableHead>
                <TableHead className="text-center">Retries</TableHead>
                <TableHead>Atualizado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mt-2">Carregando...</p>
                  </TableCell>
                </TableRow>
              ) : filteredUploads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Cloud className="h-8 w-8 mx-auto text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground mt-2">
                      {searchTerm || statusFilter !== "all" 
                        ? "Nenhum upload encontrado com os filtros aplicados" 
                        : "Nenhum upload registrado"}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredUploads.map((upload) => {
                  const config = statusConfig[upload.status] || statusConfig.queued;
                  const StatusIcon = config.icon;
                  
                  return (
                    <TableRow key={upload.id}>
                      <TableCell className="font-mono text-xs">
                        <div className="max-w-[200px] truncate" title={upload.original_url}>
                          {upload.original_url.split('/').pop() || upload.original_url}
                        </div>
                        {upload.channel_name && (
                          <div className="text-muted-foreground text-xs mt-1">
                            {upload.channel_name}
                          </div>
                        )}
                      </TableCell>
                      
                      <TableCell>
                        <Badge variant={config.variant} className="gap-1">
                          <StatusIcon className={`h-3 w-3 ${upload.status === 'processing' ? 'animate-spin' : ''}`} />
                          {config.label}
                        </Badge>
                        {upload.error_message && (
                          <p className="text-xs text-destructive mt-1 max-w-[150px] truncate" title={upload.error_message}>
                            {upload.error_message}
                          </p>
                        )}
                      </TableCell>
                      
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary transition-all"
                              style={{ width: `${upload.progress_percent}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-8">
                            {upload.progress_percent}%
                          </span>
                        </div>
                      </TableCell>
                      
                      <TableCell className="text-center">
                        <span className={`text-sm ${upload.retry_count > 0 ? 'text-orange-500' : 'text-muted-foreground'}`}>
                          {upload.retry_count}/{upload.max_retries}
                        </span>
                      </TableCell>
                      
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(upload.updated_at), { 
                          addSuffix: true, 
                          locale: ptBR 
                        })}
                      </TableCell>
                      
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {upload.cf_stream_uid && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Ver no Cloudflare"
                              asChild
                            >
                              <a 
                                href={`https://dash.cloudflare.com/?to=/:account/stream/videos/${upload.cf_stream_uid}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          
                          {(upload.status === 'failed' || upload.status === 'retry_scheduled') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleRetry(upload.id)}
                              disabled={actionLoading === upload.id}
                              title="Tentar novamente"
                            >
                              {actionLoading === upload.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RotateCcw className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          
                          {(upload.status === 'queued' || upload.status === 'retry_scheduled') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleCancel(upload.id)}
                              disabled={actionLoading === upload.id}
                              title="Cancelar"
                            >
                              {actionLoading === upload.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          )}

                          {upload.status === 'ready' && upload.cf_stream_uid && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-primary"
                                title="URL Assinada"
                                onClick={() => handleOpenSignedUrlDialog(upload.cf_stream_uid!, upload.channel_name)}
                              >
                                <Shield className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-green-500"
                                title="Preview"
                                asChild
                              >
                                <a 
                                  href={`https://customer-${upload.cf_stream_uid}.cloudflarestream.com/${upload.cf_stream_uid}/manifest/video.m3u8`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <Play className="h-4 w-4" />
                                </a>
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </ScrollArea>
        
        {filteredUploads.length > 0 && (
          <div className="p-4 border-t text-sm text-muted-foreground">
            Mostrando {filteredUploads.length} de {uploads.length} uploads
          </div>
        )}
      </CardContent>

      {/* Signed URL Dialog */}
      {selectedUpload && (
        <CFStreamSignedUrlDialog
          open={signedUrlDialogOpen}
          onOpenChange={setSignedUrlDialogOpen}
          cfStreamUid={selectedUpload.uid}
          channelName={selectedUpload.name}
        />
      )}
    </Card>
  );
}
