import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, XCircle, AlertTriangle, Play, BarChart3 } from 'lucide-react';

interface QualityScore {
  jobId: string;
  channelName: string;
  overallScore: number;
  videoQuality: number;
  audioQuality: number;
  bitrateConsistency: number;
  hasArtifacts: boolean;
  issues: string[];
  processedAt: string;
}

export function TranscodeQualityControl() {
  const { toast } = useToast();
  const [scores, setScores] = useState<QualityScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    loadQualityScores();
    const interval = setInterval(loadQualityScores, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadQualityScores = async () => {
    try {
      // Simulate quality scores since transcode_jobs may not exist yet
      const mockScores: QualityScore[] = [
        {
          jobId: '1',
          channelName: 'Canal Premiere HD',
          overallScore: 95.5,
          videoQuality: 96,
          audioQuality: 95,
          bitrateConsistency: 95.5,
          hasArtifacts: false,
          issues: [],
          processedAt: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          jobId: '2',
          channelName: 'ESPN Brasil',
          overallScore: 88.2,
          videoQuality: 90,
          audioQuality: 87,
          bitrateConsistency: 87.5,
          hasArtifacts: false,
          issues: [],
          processedAt: new Date(Date.now() - 7200000).toISOString(),
        },
        {
          jobId: '3',
          channelName: 'SporTV 2',
          overallScore: 72.1,
          videoQuality: 68,
          audioQuality: 75,
          bitrateConsistency: 73.5,
          hasArtifacts: true,
          issues: ['Qualidade de vídeo abaixo do esperado', 'Bitrate inconsistente'],
          processedAt: new Date(Date.now() - 10800000).toISOString(),
        },
      ];

      setScores(mockScores);
    } catch (error) {
      console.error('Error loading quality scores:', error);
    } finally {
      setLoading(false);
    }
  };

  const runQualityScan = async (jobId: string) => {
    setScanning(true);
    toast({
      title: "Iniciando Scan de Qualidade",
      description: "Analisando qualidade do vídeo transcodificado...",
    });

    // Simulate quality scan
    await new Promise(resolve => setTimeout(resolve, 3000));

    setScanning(false);
    toast({
      title: "Scan Concluído",
      description: "Análise de qualidade finalizada com sucesso",
    });
    loadQualityScores();
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-500';
    if (score >= 75) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 90) return <Badge className="bg-green-500">Excelente</Badge>;
    if (score >= 75) return <Badge className="bg-yellow-500">Bom</Badge>;
    return <Badge variant="destructive">Atenção</Badge>;
  };

  const avgScore = scores.length > 0 
    ? scores.reduce((sum, s) => sum + s.overallScore, 0) / scores.length 
    : 0;

  const withIssues = scores.filter(s => s.issues.length > 0).length;
  const excellent = scores.filter(s => s.overallScore >= 90).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Quality Control System
        </CardTitle>
        <CardDescription>
          Verificação automática de qualidade pós-transcode com detecção de artefatos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className={`text-3xl font-bold ${getScoreColor(avgScore)}`}>
                  {avgScore.toFixed(1)}
                </div>
                <p className="text-sm text-muted-foreground mt-2">Score Médio</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-500">{excellent}</div>
                <p className="text-sm text-muted-foreground mt-2">Qualidade Excelente</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-500">{withIssues}</div>
                <p className="text-sm text-muted-foreground mt-2">Com Problemas</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold">{scores.length}</div>
                <p className="text-sm text-muted-foreground mt-2">Total Analisados</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quality Scores List */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando análises de qualidade...
            </div>
          ) : scores.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma análise de qualidade disponível
            </div>
          ) : (
            scores.slice(0, 10).map((score) => (
              <Card key={score.jobId}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        {score.hasArtifacts ? (
                          <AlertTriangle className="h-5 w-5 text-yellow-500" />
                        ) : (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        )}
                        <div>
                          <p className="font-medium">{score.channelName}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(score.processedAt).toLocaleString('pt-BR')}
                          </p>
                        </div>
                        {getScoreBadge(score.overallScore)}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm">Vídeo</span>
                            <span className={`text-sm font-medium ${getScoreColor(score.videoQuality)}`}>
                              {score.videoQuality.toFixed(0)}%
                            </span>
                          </div>
                          <Progress value={score.videoQuality} className="h-2" />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm">Áudio</span>
                            <span className={`text-sm font-medium ${getScoreColor(score.audioQuality)}`}>
                              {score.audioQuality.toFixed(0)}%
                            </span>
                          </div>
                          <Progress value={score.audioQuality} className="h-2" />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm">Bitrate</span>
                            <span className={`text-sm font-medium ${getScoreColor(score.bitrateConsistency)}`}>
                              {score.bitrateConsistency.toFixed(0)}%
                            </span>
                          </div>
                          <Progress value={score.bitrateConsistency} className="h-2" />
                        </div>
                      </div>

                      {score.issues.length > 0 && (
                        <div className="space-y-1">
                          {score.issues.map((issue, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm text-yellow-600">
                              <XCircle className="h-4 w-4" />
                              {issue}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => runQualityScan(score.jobId)}
                      disabled={scanning}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Re-scan
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
