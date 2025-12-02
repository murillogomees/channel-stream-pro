import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, Clock, DollarSign, Zap } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';

type QualityLadderPreset = Database['public']['Enums']['quality_ladder_preset'];

interface ScheduledJob {
  url: string;
  scheduledTime: string;
  preset: QualityLadderPreset;
  priority: number;
}

export function TranscodeScheduler() {
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [preset, setPreset] = useState<QualityLadderPreset>('standard');
  const [priority, setPriority] = useState(1);
  const [scheduledJobs, setScheduledJobs] = useState<ScheduledJob[]>([]);

  // Off-peak hours (cheaper): 22:00 - 06:00
  const isOffPeak = (time: string) => {
    const hour = new Date(time).getHours();
    return hour >= 22 || hour < 6;
  };

  const getCostMultiplier = (time: string) => {
    return isOffPeak(time) ? 0.7 : 1.0; // 30% discount off-peak
  };

  const addScheduledJob = () => {
    if (!url || !scheduledTime) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha URL e horário agendado',
        variant: 'destructive',
      });
      return;
    }

    const scheduled = new Date(scheduledTime);
    if (scheduled < new Date()) {
      toast({
        title: 'Horário inválido',
        description: 'Escolha um horário futuro',
        variant: 'destructive',
      });
      return;
    }

    setScheduledJobs([...scheduledJobs, { url, scheduledTime, preset, priority }]);
    setUrl('');
    setScheduledTime('');
    
    toast({
      title: 'Job agendado',
      description: `Será processado em ${scheduled.toLocaleString('pt-BR')}`,
    });
  };

  const scheduleAll = async () => {
    if (scheduledJobs.length === 0) return;

    try {
      const jobs = scheduledJobs.map(job => ({
        source_url: job.url,
        ladder_preset: job.preset,
        priority: job.priority,
        status: 'queued' as const,
      }));

      const { error } = await supabase.from('transcode_jobs').insert(jobs);
      if (error) throw error;

      toast({
        title: 'Jobs agendados',
        description: `${jobs.length} jobs serão processados automaticamente`,
      });

      setScheduledJobs([]);
    } catch (error: any) {
      toast({
        title: 'Erro ao agendar',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Agendamento Inteligente
          </CardTitle>
          <CardDescription>
            Agende transcodificações para horários de menor custo (22h-6h: 30% desconto)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>URL do Vídeo</Label>
              <Input
                placeholder="https://example.com/video.mp4"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Horário Agendado</Label>
              <Input
                type="datetime-local"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Quality Preset</Label>
              <Select value={preset} onValueChange={(v: QualityLadderPreset) => setPreset(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">📱 Básico</SelectItem>
                  <SelectItem value="standard">💻 Standard</SelectItem>
                  <SelectItem value="premium">🎬 Premium</SelectItem>
                  <SelectItem value="ultra">⚡ Ultra</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={priority.toString()} onValueChange={(v) => setPriority(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - Normal</SelectItem>
                  <SelectItem value="2">2 - Alta</SelectItem>
                  <SelectItem value="3">3 - Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {scheduledTime && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              {isOffPeak(scheduledTime) ? (
                <>
                  <DollarSign className="h-4 w-4 text-green-500" />
                  <span className="text-sm">
                    <strong className="text-green-600">Horário Off-Peak!</strong> Economia de 30% no custo
                  </span>
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4 text-orange-500" />
                  <span className="text-sm">
                    Horário normal (custo padrão). Agende entre 22h-6h para economizar 30%
                  </span>
                </>
              )}
            </div>
          )}

          <Button onClick={addScheduledJob} className="w-full">
            <Calendar className="h-4 w-4 mr-2" />
            Adicionar à Fila de Agendamentos
          </Button>
        </CardContent>
      </Card>

      {scheduledJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Jobs Agendados ({scheduledJobs.length})</CardTitle>
            <CardDescription>
              Serão processados automaticamente nos horários definidos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {scheduledJobs.map((job, idx) => {
              const cost = getCostMultiplier(job.scheduledTime);
              const isOffPeakJob = isOffPeak(job.scheduledTime);
              
              return (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={isOffPeakJob ? 'default' : 'secondary'}>
                        {isOffPeakJob && <DollarSign className="h-3 w-3 mr-1" />}
                        {new Date(job.scheduledTime).toLocaleString('pt-BR')}
                      </Badge>
                      <Badge variant="outline">{job.preset}</Badge>
                    </div>
                    <p className="text-sm truncate text-muted-foreground">{job.url}</p>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-sm font-bold text-green-600">
                      {isOffPeakJob ? '-30%' : 'Custo normal'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Multiplicador: {cost}x
                    </div>
                  </div>
                </div>
              );
            })}

            <Button onClick={scheduleAll} className="w-full mt-4">
              <Zap className="h-4 w-4 mr-2" />
              Confirmar {scheduledJobs.length} Agendamentos
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
