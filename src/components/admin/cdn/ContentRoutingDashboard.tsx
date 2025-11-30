/**
 * Content Routing Dashboard
 * 
 * Dashboard unificado para monitorar e gerenciar roteamento de conteúdo
 * Stream vs R2 baseado em tipo e demanda
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Cloud, 
  HardDrive, 
  Tv, 
  Film, 
  PlayCircle, 
  RefreshCw,
  TrendingUp,
  BarChart3,
  Settings,
  Zap,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
  Upload
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getRoutingStats,
  getR2Candidates,
  getStreamCandidates,
  listR2Jobs,
  triggerR2Scheduler,
  triggerStreamScheduler,
  scheduleR2Downloads,
  scheduleStreamUploads,
  getRoutingConfig,
  type RoutingStats,
  type ContentCandidate,
  type R2DownloadJob,
  type RoutingConfig,
} from '@/services/contentRoutingService';

export function ContentRoutingDashboard() {
  const [stats, setStats] = useState<RoutingStats | null>(null);
  const [r2Candidates, setR2Candidates] = useState<ContentCandidate[]>([]);
  const [streamCandidates, setStreamCandidates] = useState<ContentCandidate[]>([]);
  const [r2Jobs, setR2Jobs] = useState<R2DownloadJob[]>([]);
  const [config, setConfig] = useState<RoutingConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [schedulerRunning, setSchedulerRunning] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsData, r2CandidatesData, streamCandidatesData, r2JobsData, configData] = await Promise.all([
        getRoutingStats(),
        getR2Candidates(20),
        getStreamCandidates(20),
        listR2Jobs({ limit: 20 }),
        getRoutingConfig(),
      ]);

      setStats(statsData);
      setR2Candidates(r2CandidatesData);
      setStreamCandidates(streamCandidatesData);
      setR2Jobs(r2JobsData.data);
      setConfig(configData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleTriggerR2Scheduler = async () => {
    setSchedulerRunning(true);
    try {
      const result = await triggerR2Scheduler();
      if (result.success) {
        toast.success('R2 Scheduler executado com sucesso');
        await loadData();
      } else {
        toast.error('Erro ao executar R2 Scheduler');
      }
    } finally {
      setSchedulerRunning(false);
    }
  };

  const handleTriggerStreamScheduler = async () => {
    setSchedulerRunning(true);
    try {
      const result = await triggerStreamScheduler();
      if (result.success) {
        toast.success('Stream Scheduler executado com sucesso');
        await loadData();
      } else {
        toast.error('Erro ao executar Stream Scheduler');
      }
    } finally {
      setSchedulerRunning(false);
    }
  };

  const handleScheduleR2Batch = async () => {
    const channelIds = r2Candidates.slice(0, 5).map(c => c.channel_id);
    if (channelIds.length === 0) {
      toast.warning('Nenhum candidato disponível');
      return;
    }

    const result = await scheduleR2Downloads(channelIds);
    toast.success(`${result.success} jobs agendados, ${result.failed} falharam`);
    await loadData();
  };

  const handleScheduleStreamBatch = async () => {
    const channelIds = streamCandidates.slice(0, 5).map(c => c.channel_id);
    if (channelIds.length === 0) {
      toast.warning('Nenhum candidato disponível');
      return;
    }

    const result = await scheduleStreamUploads(channelIds);
    toast.success(`${result.success} uploads agendados, ${result.failed} falharam`);
    await loadData();
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
      queued: { variant: 'secondary', icon: <Clock className="h-3 w-3" /> },
      validating: { variant: 'outline', icon: <RefreshCw className="h-3 w-3 animate-spin" /> },
      downloading: { variant: 'default', icon: <Download className="h-3 w-3" /> },
      uploading: { variant: 'default', icon: <Upload className="h-3 w-3" /> },
      processing: { variant: 'default', icon: <RefreshCw className="h-3 w-3 animate-spin" /> },
      completed: { variant: 'outline', icon: <CheckCircle className="h-3 w-3 text-green-500" /> },
      failed: { variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
      retry_scheduled: { variant: 'secondary', icon: <AlertTriangle className="h-3 w-3 text-yellow-500" /> },
    };

    const config = statusConfig[status] || { variant: 'secondary' as const, icon: null };

    return (
      <Badge variant={config.variant} className="gap-1">
        {config.icon}
        {status}
      </Badge>
    );
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Content Routing</h2>
          <p className="text-muted-foreground">
            Roteamento inteligente: Stream para Live TV, R2 para Séries/Filmes
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <PlayCircle className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Total VODs</span>
            </div>
            <p className="text-2xl font-bold">{stats?.total_vods || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">R2</span>
            </div>
            <p className="text-2xl font-bold">{stats?.in_r2 || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Cloud className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">Stream</span>
            </div>
            <p className="text-2xl font-bold">{stats?.in_stream || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Tv className="h-4 w-4 text-purple-500" />
              <span className="text-sm text-muted-foreground">Live TV</span>
            </div>
            <p className="text-2xl font-bold">{stats?.live_count || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Film className="h-4 w-4 text-pink-500" />
              <span className="text-sm text-muted-foreground">Séries</span>
            </div>
            <p className="text-2xl font-bold">{stats?.series_count || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Film className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Filmes</span>
            </div>
            <p className="text-2xl font-bold">{stats?.movies_count || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">Alta Demanda</span>
            </div>
            <p className="text-2xl font-bold">{stats?.high_demand_channels || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Strategy Explanation */}
      <Card className="bg-gradient-to-r from-blue-500/10 to-green-500/10 border-blue-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Estratégia de Roteamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-start gap-3 p-3 bg-background/50 rounded-lg">
              <Cloud className="h-5 w-5 text-orange-500 mt-0.5" />
              <div>
                <p className="font-medium">Cloudflare Stream</p>
                <p className="text-muted-foreground">TV ao vivo, canais 24h, esportes, notícias. Baixa latência, transcoding automático.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-background/50 rounded-lg">
              <HardDrive className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium">Cloudflare R2</p>
                <p className="text-muted-foreground">Séries, filmes, novelas, animes. Economia de 90%+ em custos de egress.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-background/50 rounded-lg">
              <Zap className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div>
                <p className="font-medium">Promoção Automática</p>
                <p className="text-muted-foreground">Conteúdo com alta demanda ({'>'}10 views/24h) é automaticamente migrado para CDN.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs defaultValue="r2" className="space-y-4">
        <TabsList>
          <TabsTrigger value="r2" className="gap-2">
            <HardDrive className="h-4 w-4" />
            R2 Downloads
          </TabsTrigger>
          <TabsTrigger value="stream" className="gap-2">
            <Cloud className="h-4 w-4" />
            Stream Uploads
          </TabsTrigger>
          <TabsTrigger value="candidates" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Candidatos
          </TabsTrigger>
        </TabsList>

        {/* R2 Tab */}
        <TabsContent value="r2" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex gap-4">
              <Badge variant="outline">
                Queued: {stats?.r2_jobs_queued || 0}
              </Badge>
              <Badge variant="default">
                Processing: {stats?.r2_jobs_processing || 0}
              </Badge>
              <Badge variant="secondary" className="text-green-600">
                Completed: {stats?.r2_jobs_completed || 0}
              </Badge>
              <Badge variant="destructive">
                Failed: {stats?.r2_jobs_failed || 0}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleTriggerR2Scheduler}
                disabled={schedulerRunning}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${schedulerRunning ? 'animate-spin' : ''}`} />
                Executar Scheduler
              </Button>
              <Button size="sm" onClick={handleScheduleR2Batch}>
                <Download className="h-4 w-4 mr-2" />
                Agendar Top 5
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Jobs de Download R2</CardTitle>
              <CardDescription>Downloads ativos e recentes para Cloudflare R2</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {r2Jobs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhum job encontrado</p>
                ) : (
                  <div className="space-y-2">
                    {r2Jobs.map((job) => (
                      <div key={job.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-sm truncate max-w-md">
                            {(job.metadata as Record<string, unknown>)?.channel_name as string || job.channel_id}
                          </p>
                          <p className="text-xs text-muted-foreground truncate max-w-md">
                            {job.original_url}
                          </p>
                          {job.error_message && (
                            <p className="text-xs text-destructive">{job.error_message}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          {job.status === 'downloading' || job.status === 'uploading' ? (
                            <div className="w-24">
                              <Progress value={job.progress_percent} className="h-2" />
                              <p className="text-xs text-center mt-1">{job.progress_percent}%</p>
                            </div>
                          ) : null}
                          {getStatusBadge(job.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stream Tab */}
        <TabsContent value="stream" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex gap-4">
              <Badge variant="outline">
                Queued: {stats?.stream_jobs_queued || 0}
              </Badge>
              <Badge variant="default">
                Processing: {stats?.stream_jobs_processing || 0}
              </Badge>
              <Badge variant="secondary" className="text-green-600">
                Ready: {stats?.stream_jobs_ready || 0}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleTriggerStreamScheduler}
                disabled={schedulerRunning}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${schedulerRunning ? 'animate-spin' : ''}`} />
                Executar Scheduler
              </Button>
              <Button size="sm" onClick={handleScheduleStreamBatch}>
                <Upload className="h-4 w-4 mr-2" />
                Agendar Top 5
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Info: Cloudflare Stream</CardTitle>
              <CardDescription>Uploads para Stream são gerenciados pelo cf-stream-scheduler</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Para visualizar e gerenciar uploads do Cloudflare Stream, acesse a aba "Stream" no dashboard de VOD Storage.
                O Stream é priorizado para:
              </p>
              <ul className="list-disc list-inside mt-2 text-sm text-muted-foreground space-y-1">
                <li>TV ao vivo e canais 24 horas</li>
                <li>Conteúdo esportivo e eventos</li>
                <li>Notícias e programação linear</li>
                <li>Catálogo geral VOD (fallback)</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Candidates Tab */}
        <TabsContent value="candidates" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* R2 Candidates */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5 text-green-500" />
                  Candidatos R2
                </CardTitle>
                <CardDescription>Séries, filmes e conteúdo com alta demanda</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  {r2Candidates.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Nenhum candidato</p>
                  ) : (
                    <div className="space-y-2">
                      {r2Candidates.map((candidate) => (
                        <div key={candidate.channel_id} className="p-2 border rounded text-sm">
                          <p className="font-medium truncate">{candidate.channel_name}</p>
                          <div className="flex justify-between items-center mt-1">
                            <Badge variant="outline" className="text-xs">{candidate.reason}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {candidate.views_24h} views
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Stream Candidates */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cloud className="h-5 w-5 text-orange-500" />
                  Candidatos Stream
                </CardTitle>
                <CardDescription>TV ao vivo e catálogo geral</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  {streamCandidates.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Nenhum candidato</p>
                  ) : (
                    <div className="space-y-2">
                      {streamCandidates.map((candidate) => (
                        <div key={candidate.channel_id} className="p-2 border rounded text-sm">
                          <p className="font-medium truncate">{candidate.channel_name}</p>
                          <div className="flex justify-between items-center mt-1">
                            <Badge variant="outline" className="text-xs">{candidate.reason}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {candidate.views_24h} views
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Config Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações de Roteamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            {config.map((cfg) => (
              <div key={cfg.config_key} className="p-3 border rounded-lg">
                <p className="font-medium text-sm">{cfg.config_key}</p>
                <p className="text-xs text-muted-foreground mt-1">{cfg.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
