/**
 * BuildHistoryTable - Histórico de builds
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  History, 
  Search, 
  Trash2, 
  Download,
  Eye,
  Filter
} from "lucide-react";
import { useBuildSystem } from "./hooks/useBuildSystem";
import { BuildJob, PLATFORM_LABELS, BUILD_STATUS_COLORS } from "./types";
import { cn } from "@/lib/utils";

export function BuildHistoryTable() {
  const { jobs, clearHistory } = useBuildSystem();
  const [search, setSearch] = useState("");
  const [selectedJob, setSelectedJob] = useState<BuildJob | null>(null);

  const filteredJobs = jobs.filter(job => 
    PLATFORM_LABELS[job.platform].toLowerCase().includes(search.toLowerCase()) ||
    job.status.toLowerCase().includes(search.toLowerCase())
  ).reverse();

  const formatDuration = (start?: string, end?: string) => {
    if (!start) return '-';
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();
    const diff = Math.round((endDate.getTime() - startDate.getTime()) / 1000);
    
    if (diff < 60) return `${diff}s`;
    const minutes = Math.floor(diff / 60);
    const seconds = diff % 60;
    return `${minutes}m ${seconds}s`;
  };

  return (
    <>
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico de Builds
            </CardTitle>
            <div className="flex gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="outline" size="icon" onClick={clearHistory}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <History className="h-12 w-12 mb-2 opacity-50" />
              <p>Nenhum build no histórico</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plataforma</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Início</TableHead>
                    <TableHead className="hidden md:table-cell">Duração</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium">
                        {PLATFORM_LABELS[job.platform]}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("text-xs", BUILD_STATUS_COLORS[job.status])}>
                          {job.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {job.startedAt && new Date(job.startedAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {formatDuration(job.startedAt, job.completedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => setSelectedJob(job)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {job.status === 'success' && (
                            <Button variant="ghost" size="icon">
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Job Details Dialog */}
      <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Detalhes do Build - {selectedJob && PLATFORM_LABELS[selectedJob.platform]}
            </DialogTitle>
          </DialogHeader>
          
          {selectedJob && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className={cn("mt-1", BUILD_STATUS_COLORS[selectedJob.status])}>
                    {selectedJob.status}
                  </Badge>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Duração</p>
                  <p className="font-medium mt-1">
                    {formatDuration(selectedJob.startedAt, selectedJob.completedAt)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Início</p>
                  <p className="font-medium mt-1">
                    {selectedJob.startedAt && new Date(selectedJob.startedAt).toLocaleString()}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Conclusão</p>
                  <p className="font-medium mt-1">
                    {selectedJob.completedAt 
                      ? new Date(selectedJob.completedAt).toLocaleString()
                      : 'Em andamento'
                    }
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Logs</p>
                <ScrollArea className="h-[200px] rounded-lg bg-black/90 p-3">
                  <div className="font-mono text-xs text-green-400 space-y-1">
                    {selectedJob.logs.map((log, i) => (
                      <p key={i}>{log}</p>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {selectedJob.error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm font-medium text-destructive">Erro</p>
                  <p className="text-sm mt-1">{selectedJob.error}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
