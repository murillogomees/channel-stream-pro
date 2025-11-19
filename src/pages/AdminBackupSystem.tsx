import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Calendar, FileJson, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { backupService, BackupData } from '@/services/backupService';

export default function AdminBackupSystem() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [lastBackup, setLastBackup] = useState<BackupData | null>(null);

  const handleCreateBackup = async () => {
    try {
      setLoading(true);
      const backup = await backupService.createBackup();
      setLastBackup(backup);
      
      toast({
        title: 'Backup criado com sucesso',
        description: `${backup.total_clientes} clientes incluídos no backup`,
      });
    } catch (error: any) {
      console.error('Erro ao criar backup:', error);
      toast({
        title: 'Erro ao criar backup',
        description: error.message || 'Não foi possível criar o backup',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadJSON = () => {
    if (!lastBackup) return;
    backupService.downloadBackupJSON(lastBackup);
    toast({
      title: 'Download iniciado',
      description: 'Backup em formato JSON',
    });
  };

  const handleDownloadCSV = () => {
    if (!lastBackup) return;
    backupService.downloadBackupCSV(lastBackup);
    toast({
      title: 'Download iniciado',
      description: 'Backup em formato CSV',
    });
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Sistema de Backup</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Backup automático dos dados dos clientes
            </p>
          </div>
        </div>

        {/* Actions Card */}
        <Card>
          <CardHeader>
            <CardTitle>Criar Novo Backup</CardTitle>
            <CardDescription>
              Gere um backup completo de todos os dados dos clientes incluindo M3U lists atribuídas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button 
                onClick={handleCreateBackup} 
                disabled={loading}
                className="flex-1"
              >
                <Calendar className="h-4 w-4 mr-2" />
                {loading ? 'Criando backup...' : 'Criar Backup Agora'}
              </Button>
            </div>

            {lastBackup && (
              <div className="pt-4 border-t space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Último backup criado</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(lastBackup.timestamp).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {lastBackup.total_clientes} clientes
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Button 
                    variant="outline" 
                    onClick={handleDownloadJSON}
                    className="w-full"
                  >
                    <FileJson className="h-4 w-4 mr-2" />
                    Download JSON
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleDownloadCSV}
                    className="w-full"
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Download CSV
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Backup Statistics */}
        {lastBackup && (
          <Card>
            <CardHeader>
              <CardTitle>Estatísticas do Último Backup</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total de Clientes</p>
                  <p className="text-2xl font-bold">{lastBackup.metadata.total_active + lastBackup.metadata.total_inactive}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Clientes Ativos</p>
                  <p className="text-2xl font-bold text-green-600">{lastBackup.metadata.total_active}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Clientes Inativos</p>
                  <p className="text-2xl font-bold text-gray-600">{lastBackup.metadata.total_inactive}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Testando</p>
                  <p className="text-2xl font-bold">{lastBackup.metadata.by_situation.testando}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Ativos</p>
                  <p className="text-2xl font-bold">{lastBackup.metadata.by_situation.ativo}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Leads</p>
                  <p className="text-2xl font-bold">{lastBackup.metadata.by_situation.lead}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Backup Schedule Info */}
        <Card>
          <CardHeader>
            <CardTitle>Agendamento Automático</CardTitle>
            <CardDescription>
              Configure backups automáticos periódicos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2">Backup Automático Diário</h4>
                <p className="text-sm text-muted-foreground">
                  Um backup automático é executado diariamente às 03:00 AM (horário do servidor).
                  Os backups são armazenados pelo edge function e podem ser baixados através desta página.
                </p>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm font-medium">Formatos de Backup Disponíveis:</p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>JSON - Formato completo com todos os metadados</li>
                  <li>CSV - Formato tabular para importação em planilhas</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
