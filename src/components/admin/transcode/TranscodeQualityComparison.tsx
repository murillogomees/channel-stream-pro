import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Video, Maximize } from 'lucide-react';

interface Resolution {
  label: string;
  width: number;
  height: number;
  url?: string;
}

export function TranscodeQualityComparison() {
  const [selectedJob, setSelectedJob] = useState<string>('');
  const [leftResolution, setLeftResolution] = useState<string>('720p');
  const [rightResolution, setRightResolution] = useState<string>('1080p');

  const resolutions: Resolution[] = [
    { label: '360p', width: 640, height: 360 },
    { label: '480p', width: 854, height: 480 },
    { label: '720p', width: 1280, height: 720 },
    { label: '1080p', width: 1920, height: 1080 },
    { label: '4K', width: 3840, height: 2160 },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5" />
          Comparação de Qualidade
        </CardTitle>
        <CardDescription>
          Preview lado a lado das diferentes resoluções
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Job ID</label>
          <Select value={selectedJob} onValueChange={setSelectedJob}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um job concluído" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="job1">Job #1 - Vídeo Teste A</SelectItem>
              <SelectItem value="job2">Job #2 - Vídeo Teste B</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Esquerda</label>
            <Select value={leftResolution} onValueChange={setLeftResolution}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {resolutions.map((res) => (
                  <SelectItem key={res.label} value={res.label}>
                    {res.label} ({res.width}x{res.height})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Direita</label>
            <Select value={rightResolution} onValueChange={setRightResolution}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {resolutions.map((res) => (
                  <SelectItem key={res.label} value={res.label}>
                    {res.label} ({res.width}x{res.height})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedJob && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="secondary">{leftResolution}</Badge>
                <Maximize className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                <Video className="h-12 w-12 text-muted-foreground" />
              </div>
              <div className="text-xs text-muted-foreground text-center">
                Player {leftResolution} aqui
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="secondary">{rightResolution}</Badge>
                <Maximize className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                <Video className="h-12 w-12 text-muted-foreground" />
              </div>
              <div className="text-xs text-muted-foreground text-center">
                Player {rightResolution} aqui
              </div>
            </div>
          </div>
        )}

        {!selectedJob && (
          <div className="p-8 text-center text-muted-foreground border rounded-lg">
            Selecione um job para comparar resoluções
          </div>
        )}
      </CardContent>
    </Card>
  );
}
