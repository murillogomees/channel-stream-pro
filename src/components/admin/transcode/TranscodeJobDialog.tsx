import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';

type QualityLadderPreset = Database['public']['Enums']['quality_ladder_preset'];

interface TranscodeJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function TranscodeJobDialog({ open, onOpenChange, onSuccess }: TranscodeJobDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    source_url: '',
    ladder_preset: 'standard' as QualityLadderPreset,
    priority: 1,
  });

  const handleSubmit = async () => {
    if (!formData.source_url) {
      toast({
        title: 'Erro',
        description: 'URL do vídeo é obrigatória',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('transcode_jobs')
        .insert({
          source_url: formData.source_url,
          ladder_preset: formData.ladder_preset,
          priority: formData.priority,
          status: 'queued',
        });

      if (error) throw error;

      onSuccess();
      
      // Reset form
      setFormData({
        source_url: '',
        ladder_preset: 'standard',
        priority: 1,
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao criar job',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Novo Job de Transcodificação</DialogTitle>
          <DialogDescription>
            Adicione um vídeo à fila de transcodificação do Cloudflare Stream
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="source-url">URL do Vídeo Original *</Label>
            <Input
              id="source-url"
              placeholder="https://example.com/video.mp4"
              value={formData.source_url}
              onChange={(e) => setFormData({ ...formData, source_url: e.target.value })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              URL pública do vídeo que será transcodificado
            </p>
          </div>

          <div>
            <Label htmlFor="ladder-preset">Qualidade (Quality Ladder)</Label>
            <Select 
              value={formData.ladder_preset} 
              onValueChange={(v: QualityLadderPreset) => setFormData({ ...formData, ladder_preset: v })}
            >
              <SelectTrigger id="ladder-preset">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="basic">
                  📱 Básico (360p, 480p)
                </SelectItem>
                <SelectItem value="standard">
                  💻 Standard (360p, 480p, 720p)
                </SelectItem>
                <SelectItem value="premium">
                  🎬 Premium (360p-1080p)
                </SelectItem>
                <SelectItem value="ultra">
                  ⚡ Ultra (360p-4K)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Define as resoluções geradas no Cloudflare Stream
            </p>
          </div>

          <div>
            <Label htmlFor="priority">Prioridade</Label>
            <Select 
              value={formData.priority.toString()} 
              onValueChange={(v) => setFormData({ ...formData, priority: parseInt(v) })}
            >
              <SelectTrigger id="priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 - Normal</SelectItem>
                <SelectItem value="2">2 - Alta</SelectItem>
                <SelectItem value="3">3 - Urgente</SelectItem>
                <SelectItem value="4">4 - Crítica</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Jobs com maior prioridade são processados primeiro
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Criar Job
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
