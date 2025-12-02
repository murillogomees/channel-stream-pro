import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, X, Loader2, CheckCircle } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';

type QualityLadderPreset = Database['public']['Enums']['quality_ladder_preset'];

interface BatchVideo {
  url: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

export function TranscodeBatchUpload({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [videos, setVideos] = useState<BatchVideo[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [ladderPreset, setLadderPreset] = useState<QualityLadderPreset>('standard');
  const [priority, setPriority] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);

  const addVideo = () => {
    if (!urlInput.trim()) return;
    setVideos([...videos, { url: urlInput.trim(), status: 'pending' }]);
    setUrlInput('');
  };

  const removeVideo = (index: number) => {
    setVideos(videos.filter((_, i) => i !== index));
  };

  const processBatch = async () => {
    if (videos.length === 0) return;

    setIsProcessing(true);
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      setVideos(prev => prev.map((v, idx) => 
        idx === i ? { ...v, status: 'uploading' } : v
      ));

      try {
        const { error } = await supabase.from('transcode_jobs').insert({
          source_url: video.url,
          ladder_preset: ladderPreset,
          priority,
          status: 'queued',
        });

        if (error) throw error;

        setVideos(prev => prev.map((v, idx) => 
          idx === i ? { ...v, status: 'success' } : v
        ));
        successCount++;
      } catch (error: any) {
        setVideos(prev => prev.map((v, idx) => 
          idx === i ? { ...v, status: 'error', error: error.message } : v
        ));
        errorCount++;
      }

      // Small delay between uploads
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    setIsProcessing(false);
    toast({
      title: 'Batch concluído',
      description: `${successCount} sucesso, ${errorCount} erros`,
      variant: successCount > 0 ? 'default' : 'destructive',
    });

    if (successCount > 0) {
      onSuccess();
      setVideos([]);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload em Lote
        </CardTitle>
        <CardDescription>
          Adicione múltiplos vídeos para transcodificação simultânea
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>URL do Vídeo</Label>
          <div className="flex gap-2">
            <Input
              placeholder="https://example.com/video.mp4"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addVideo()}
            />
            <Button onClick={addVideo} size="sm">
              Adicionar
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Quality Ladder</Label>
            <Select value={ladderPreset} onValueChange={(v: QualityLadderPreset) => setLadderPreset(v)}>
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

        {videos.length > 0 && (
          <div className="space-y-2">
            <Label>Vídeos na Fila ({videos.length})</Label>
            <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-2">
              {videos.map((video, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 p-2 border rounded">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {video.status === 'pending' && <Badge variant="secondary">Pendente</Badge>}
                    {video.status === 'uploading' && (
                      <Badge variant="default" className="flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Enviando
                      </Badge>
                    )}
                    {video.status === 'success' && (
                      <Badge variant="outline" className="bg-green-50 border-green-200">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Sucesso
                      </Badge>
                    )}
                    {video.status === 'error' && (
                      <Badge variant="destructive">Erro</Badge>
                    )}
                    <span className="text-sm truncate">{video.url}</span>
                  </div>
                  {video.status === 'pending' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeVideo(idx)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <Button
          onClick={processBatch}
          disabled={videos.length === 0 || isProcessing}
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processando {videos.filter(v => v.status === 'uploading').length}/{videos.length}
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Enviar {videos.length} Vídeos
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
