import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Calendar, FileJson, FileSpreadsheet, Database, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface BackupStats {
  total: number;
  ativos: number;
  inativos: number;
  testando: number;
  vencidos: number;
}

export default function AdminBackupSystem() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [lastBackupDate, setLastBackupDate] = useState<Date | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data: profiles, error } = await (supabase
        .from('profiles')
        .select('*') as any);

      if (error) throw error;

      const stats: BackupStats = {
        total: profiles?.length || 0,
        ativos: profiles?.filter((c: any) => c.cliente_ativo).length || 0,
        inativos: profiles?.filter((c: any) => !c.cliente_ativo).length || 0,
        testando: profiles?.filter((c: any) => c.situacao === 'Testando').length || 0,
        vencidos: profiles?.filter((c: any) => {
          if (!c.data_vencimento) return false;
          return new Date(c.data_vencimento) < new Date();
        }).length || 0,
      };

      setStats(stats);
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
    }
  };

  const handleExportJSON = async () => {
    try {
      setLoading(true);
      
      const { data: profiles, error } = await (supabase
        .from('profiles')
        .select('*') as any);

      if (error) throw error;

      const backup = {
        timestamp: new Date().toISOString(),
        total_profiles: profiles?.length || 0,
        profiles: profiles,
        metadata: {
          backup_date: new Date().toISOString(),
          backup_version: '1.0',
          stats: stats,
        }
      };

      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup_clientes_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);

      setLastBackupDate(new Date());

      toast({
        title: 'Backup exportado com sucesso',
        description: `${profiles?.length || 0} perfis exportados em JSON`,
      });
    } catch (error: any) {
      console.error('Erro ao exportar JSON:', error);
      toast({
        title: 'Erro ao exportar backup',
        description: error.message || 'Não foi possível criar o backup',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      setLoading(true);
      
      const { data: profiles, error } = await (supabase
        .from('profiles')
        .select('*') as any);

      if (error) throw error;

      const headers = [
        'ID',
        'Nome',
        'Telefone',
        'Email',
        'Situação',
        'Plano',
        'Data Cadastro',
        'Data Vencimento',
        'Cliente Ativo',
        'Origem Cadastro',
        'M3U Lists',
      ];

      const rows = profiles?.map((profile: any) => [
        profile.id,
        profile.nome,
        profile.contact_phone || '',
        profile.email || '',
        profile.situacao,
        profile.plano,
        profile.created_at,
        profile.data_vencimento || '',
        profile.cliente_ativo ? 'Sim' : 'Não',
        profile.origem_cadastro || '',
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(row => 
          row.map(cell => 
            typeof cell === 'string' && cell.includes(',') 
              ? `"${cell}"` 
              : cell
          ).join(',')
        ),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup_clientes_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      setLastBackupDate(new Date());

      toast({
        title: 'Backup exportado com sucesso',
        description: `${profiles?.length || 0} perfis exportados em CSV`,
      });
    } catch (error: any) {
      console.error('Erro ao exportar CSV:', error);
      toast({
        title: 'Erro ao exportar backup',
        description: error.message || 'Não foi possível criar o backup',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4 md:p-8 overflow-x-hidden">
      <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/dashboard')}
              className="flex-shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold truncate">Sistema de Backup</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 line-clamp-2">
                Exportação e backup dos dados do sistema
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={fetchStats}
            disabled={loading}
            className="flex-shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Statistics Card */}
        {stats && (
          <Card>
            <CardHeader>
              <CardTitle>Estatísticas do Banco de Dados</CardTitle>
              <CardDescription>
                Resumo dos dados atualmente no sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total de Clientes</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Clientes Ativos</p>
                  <p className="text-2xl font-bold text-green-600">{stats.ativos}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Clientes Inativos</p>
                  <p className="text-2xl font-bold text-gray-600">{stats.inativos}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Testando</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.testando}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Vencidos</p>
                  <p className="text-2xl font-bold text-red-600">{stats.vencidos}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Export Actions Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Exportar Dados
            </CardTitle>
            <CardDescription>
              Exporte todos os dados dos clientes em diferentes formatos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button 
                onClick={handleExportJSON}
                disabled={loading}
                className="h-24 flex-col gap-2"
                variant="outline"
              >
                <FileJson className="h-8 w-8" />
                <span>Exportar JSON</span>
                <span className="text-xs text-muted-foreground">Formato completo</span>
              </Button>
              
              <Button 
                onClick={handleExportCSV}
                disabled={loading}
                className="h-24 flex-col gap-2"
                variant="outline"
              >
                <FileSpreadsheet className="h-8 w-8" />
                <span>Exportar CSV</span>
                <span className="text-xs text-muted-foreground">Para planilhas</span>
              </Button>
            </div>

            {lastBackupDate && (
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Último backup exportado</p>
                    <p className="text-sm text-muted-foreground">
                      {lastBackupDate.toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                    <Download className="h-3 w-3 mr-1" />
                    Concluído
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Informações sobre Backup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Formatos Disponíveis:</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li><strong>JSON</strong> - Formato completo com todos os dados e relacionamentos, ideal para backup e restauração</li>
                <li><strong>CSV</strong> - Formato tabular compatível com Excel e Google Sheets, ideal para análise e relatórios</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Dados Incluídos:</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Informações completas de todos os clientes</li>
                <li>Listas M3U atribuídas a cada cliente</li>
                <li>Histórico de pagamentos e vencimentos</li>
                <li>Origem de cadastro e metadados</li>
              </ul>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Importante:</strong> Mantenha backups regulares dos seus dados em um local seguro. 
                Recomendamos realizar backups pelo menos uma vez por semana.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
