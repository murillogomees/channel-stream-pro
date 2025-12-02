import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Package, Play, Save, FileText, Zap } from 'lucide-react';

interface BatchTemplate {
  id: string;
  name: string;
  description: string;
  preset: string;
  priority: string;
  autoStart: boolean;
  channelIds: string[];
  created_at: string;
}

export function TranscodeBatchOperations() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<BatchTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  
  // New template form
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [preset, setPreset] = useState('standard');
  const [priority, setPriority] = useState('normal');
  const [autoStart, setAutoStart] = useState(false);
  const [channelList, setChannelList] = useState('');

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    // Simulate loading templates
    const mockTemplates: BatchTemplate[] = [
      {
        id: '1',
        name: 'Nightly Batch Processing',
        description: 'Processa todos os canais durante a madrugada',
        preset: 'premium',
        priority: 'low',
        autoStart: true,
        channelIds: ['ch1', 'ch2', 'ch3'],
        created_at: new Date().toISOString(),
      },
      {
        id: '2',
        name: 'High Priority Emergency',
        description: 'Template para processamento urgente',
        preset: 'standard',
        priority: 'critical',
        autoStart: false,
        channelIds: [],
        created_at: new Date().toISOString(),
      },
    ];
    setTemplates(mockTemplates);
  };

  const saveTemplate = async () => {
    if (!templateName.trim()) {
      toast({
        title: "Nome Obrigatório",
        description: "Informe um nome para o template",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const channelIds = channelList
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    const newTemplate: BatchTemplate = {
      id: Date.now().toString(),
      name: templateName,
      description: templateDesc,
      preset,
      priority,
      autoStart,
      channelIds,
      created_at: new Date().toISOString(),
    };

    setTemplates([...templates, newTemplate]);

    toast({
      title: "Template Salvo",
      description: `Template "${templateName}" criado com sucesso`,
    });

    // Reset form
    setTemplateName('');
    setTemplateDesc('');
    setChannelList('');
    setLoading(false);
  };

  const executeTemplate = async (template: BatchTemplate) => {
    setLoading(true);
    toast({
      title: "Executando Template",
      description: `Criando ${template.channelIds.length} jobs em lote...`,
    });

    // Simulate batch creation
    await new Promise(resolve => setTimeout(resolve, 2000));

    toast({
      title: "Batch Executado",
      description: `${template.channelIds.length} jobs criados com preset ${template.preset}`,
    });
    setLoading(false);
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, any> = {
      critical: 'destructive',
      high: 'default',
      normal: 'secondary',
      low: 'outline',
    };
    return <Badge variant={variants[priority] || 'secondary'}>{priority}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Batch Operations Manager
        </CardTitle>
        <CardDescription>
          Templates de configuração, operações em massa e workflow automation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Create Template Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Criar Novo Template</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="template-name">Nome do Template</Label>
                <Input
                  id="template-name"
                  placeholder="Ex: Processamento Noturno"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="preset">Preset de Qualidade</Label>
                <Select value={preset} onValueChange={setPreset}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Basic (720p)</SelectItem>
                    <SelectItem value="standard">Standard (1080p)</SelectItem>
                    <SelectItem value="premium">Premium (1080p + 4K)</SelectItem>
                    <SelectItem value="ultra">Ultra (4K HDR)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-desc">Descrição</Label>
              <Input
                id="template-desc"
                placeholder="Descreva o propósito deste template"
                value={templateDesc}
                onChange={(e) => setTemplateDesc(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Prioridade</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="critical">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2 pt-8">
                <input
                  type="checkbox"
                  id="auto-start"
                  checked={autoStart}
                  onChange={(e) => setAutoStart(e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="auto-start">Iniciar automaticamente</Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="channels">Channel IDs (um por linha)</Label>
              <Textarea
                id="channels"
                placeholder="channel-id-1&#10;channel-id-2&#10;channel-id-3"
                value={channelList}
                onChange={(e) => setChannelList(e.target.value)}
                rows={5}
              />
              <p className="text-sm text-muted-foreground">
                {channelList.split('\n').filter(l => l.trim()).length} canais
              </p>
            </div>

            <Button onClick={saveTemplate} disabled={loading} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              Salvar Template
            </Button>
          </CardContent>
        </Card>

        {/* Saved Templates */}
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Templates Salvos ({templates.length})
          </h3>

          {templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum template salvo ainda
            </div>
          ) : (
            templates.map((template) => (
              <Card key={template.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <h4 className="font-semibold">{template.name}</h4>
                        {getPriorityBadge(template.priority)}
                        {template.autoStart && (
                          <Badge variant="outline" className="gap-1">
                            <Zap className="h-3 w-3" />
                            Auto
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground">{template.description}</p>

                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">
                          Preset: <span className="font-medium">{template.preset}</span>
                        </span>
                        <span className="text-muted-foreground">
                          Canais: <span className="font-medium">{template.channelIds.length}</span>
                        </span>
                        <span className="text-muted-foreground">
                          Criado: {new Date(template.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>

                    <Button
                      onClick={() => executeTemplate(template)}
                      disabled={loading}
                      size="sm"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Executar
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
