/**
 * Admin page for managing clientes → profiles migration
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Play, 
  Pause, 
  RefreshCw, 
  Download, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Database,
  Users,
  ArrowRightLeft,
  Shield,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useProfilesMigration } from '@/hooks/useProfilesMigration';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AdminProfilesMigration() {
  const navigate = useNavigate();
  const {
    stats,
    jobs,
    currentJob,
    featureFlag,
    isLoading,
    isRunning,
    startMigration,
    pauseMigration,
    toggleFeatureFlag,
    retryFailed,
    exportLogs,
    validateMigration,
    refresh,
  } = useProfilesMigration();

  const [batchSize, setBatchSize] = useState(100);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');

  const progress = currentJob 
    ? (currentJob.processed_records / currentJob.total_records) * 100 
    : 0;

  const canEnableProfilesOnly = stats && stats.successRate >= 99.5 && stats.errorCount === 0;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Migração: Clientes → Profiles</h1>
              <p className="text-muted-foreground">
                Consolida todos os dados de clientes na tabela profiles
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={refresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button variant="outline" onClick={validateMigration}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Validar
            </Button>
          </div>
        </div>

        {/* Feature Flag Alert */}
        {featureFlag && (
          <Alert variant={featureFlag.enabled ? 'default' : 'destructive'}>
            <Shield className="h-4 w-4" />
            <AlertTitle>
              Feature Flag: USE_PROFILES_ONLY = {featureFlag.enabled ? 'TRUE' : 'FALSE'}
            </AlertTitle>
            <AlertDescription>
              {featureFlag.enabled 
                ? 'Sistema está usando apenas a tabela profiles. Tabela clientes está em modo somente-leitura.'
                : 'Sistema ainda usa fallback para tabela clientes quando necessário.'}
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                <Database className="h-4 w-4 inline mr-2" />
                Total Clientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalClientes || 0}</div>
              <p className="text-xs text-muted-foreground">Registros na tabela clientes</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                <Users className="h-4 w-4 inline mr-2" />
                Total Profiles
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalProfiles || 0}</div>
              <p className="text-xs text-muted-foreground">Registros na tabela profiles</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                <ArrowRightLeft className="h-4 w-4 inline mr-2" />
                Migrados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats?.migratedProfiles || 0}</div>
              <p className="text-xs text-muted-foreground">
                Taxa: {stats?.successRate.toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                <AlertTriangle className="h-4 w-4 inline mr-2" />
                Pendentes / Erros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <span className="text-yellow-600">{stats?.pendingMigration || 0}</span>
                {' / '}
                <span className="text-red-600">{stats?.errorCount || 0}</span>
              </div>
              <p className="text-xs text-muted-foreground">Aguardando / Com erro</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="migration" className="space-y-4">
          <TabsList>
            <TabsTrigger value="migration">Migração</TabsTrigger>
            <TabsTrigger value="jobs">Histórico de Jobs</TabsTrigger>
            <TabsTrigger value="errors">Erros</TabsTrigger>
            <TabsTrigger value="settings">Configurações</TabsTrigger>
          </TabsList>

          {/* Migration Tab */}
          <TabsContent value="migration" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Controle de Migração</CardTitle>
                <CardDescription>
                  Inicie, pause ou monitore o progresso da migração
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Current Job Progress */}
                {currentJob && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">Job: {currentJob.job_id.slice(0, 8)}...</p>
                        <p className="text-sm text-muted-foreground">
                          Status: <Badge variant={currentJob.status === 'completed' ? 'default' : 'secondary'}>
                            {currentJob.status}
                          </Badge>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">
                          {currentJob.processed_records} / {currentJob.total_records}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ✓ {currentJob.success_count} | ✗ {currentJob.error_count}
                        </p>
                      </div>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                )}

                {/* Controls */}
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <Label htmlFor="batchSize">Tamanho do Batch</Label>
                    <Input
                      id="batchSize"
                      type="number"
                      value={batchSize}
                      onChange={(e) => setBatchSize(parseInt(e.target.value) || 100)}
                      min={10}
                      max={1000}
                      className="w-32"
                    />
                  </div>
                  
                  {isRunning ? (
                    <Button variant="destructive" onClick={pauseMigration}>
                      <Pause className="h-4 w-4 mr-2" />
                      Pausar
                    </Button>
                  ) : (
                    <Button onClick={() => startMigration(batchSize)} disabled={isLoading}>
                      <Play className="h-4 w-4 mr-2" />
                      Iniciar Migração
                    </Button>
                  )}
                </div>

                {/* Migration Steps Info */}
                <div className="border rounded-lg p-4 bg-muted/50">
                  <h4 className="font-medium mb-2">Fases da Migração</h4>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                    <li>Dry Run: Validar mapeamento sem alterações</li>
                    <li>Sample (1%): Migrar amostra e validar</li>
                    <li>10% Stratified: Migrar por tipo/tamanho</li>
                    <li>Bulk: Migrar restante em batches</li>
                    <li>Ativar USE_PROFILES_ONLY (somente leitura)</li>
                    <li>Flip writes para profiles</li>
                    <li>Deprecar tabela clientes (após 7 dias estável)</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Jobs History Tab */}
          <TabsContent value="jobs">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Jobs</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job ID</TableHead>
                      <TableHead>Iniciado</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Processados</TableHead>
                      <TableHead>Sucesso</TableHead>
                      <TableHead>Erros</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow key={job.job_id}>
                        <TableCell className="font-mono text-xs">
                          {job.job_id.slice(0, 8)}...
                        </TableCell>
                        <TableCell>
                          {format(new Date(job.started_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              job.status === 'completed' ? 'default' :
                              job.status === 'failed' ? 'destructive' :
                              job.status === 'running' ? 'secondary' : 'outline'
                            }
                          >
                            {job.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{job.processed_records}/{job.total_records}</TableCell>
                        <TableCell className="text-green-600">{job.success_count}</TableCell>
                        <TableCell className="text-red-600">{job.error_count}</TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => exportLogs(job.job_id)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {jobs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          Nenhum job de migração encontrado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Errors Tab */}
          <TabsContent value="errors">
            <Card>
              <CardHeader>
                <CardTitle>Erros de Migração</CardTitle>
                <CardDescription>
                  Registros que falharam durante a migração
                </CardDescription>
              </CardHeader>
              <CardContent>
                {stats?.errorCount === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
                    <p>Nenhum erro encontrado</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente ID</TableHead>
                        <TableHead>Erro</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Errors will be loaded here */}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Configurações de Migração</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Feature Flag Toggle */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <Label className="text-base">USE_PROFILES_ONLY</Label>
                    <p className="text-sm text-muted-foreground">
                      Quando ativado, sistema usa apenas profiles. Clientes fica somente-leitura.
                    </p>
                    {!canEnableProfilesOnly && !featureFlag?.enabled && (
                      <p className="text-sm text-yellow-600">
                        ⚠️ Requer taxa de sucesso ≥ 99.5% e zero erros críticos
                      </p>
                    )}
                  </div>
                  
                  <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                    <DialogTrigger asChild>
                      <Switch 
                        checked={featureFlag?.enabled || false}
                        disabled={!canEnableProfilesOnly && !featureFlag?.enabled}
                      />
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Confirmar Alteração</DialogTitle>
                        <DialogDescription>
                          {featureFlag?.enabled 
                            ? 'Desativar USE_PROFILES_ONLY irá reativar o fallback para tabela clientes.'
                            : 'Ativar USE_PROFILES_ONLY irá usar APENAS a tabela profiles. A tabela clientes ficará em modo somente-leitura.'}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Digite "CONFIRMAR" para continuar</Label>
                          <Input 
                            value={confirmInput}
                            onChange={(e) => setConfirmInput(e.target.value)}
                            placeholder="CONFIRMAR"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
                          Cancelar
                        </Button>
                        <Button 
                          variant={featureFlag?.enabled ? 'destructive' : 'default'}
                          disabled={confirmInput !== 'CONFIRMAR'}
                          onClick={() => {
                            toggleFeatureFlag();
                            setShowConfirmDialog(false);
                            setConfirmInput('');
                          }}
                        >
                          {featureFlag?.enabled ? 'Desativar' : 'Ativar'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* Mapping Info */}
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-4">Mapeamento de Campos</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campo (clientes)</TableHead>
                        <TableHead>→</TableHead>
                        <TableHead>Campo (profiles)</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        ['id', 'cliente_legacy_id', true],
                        ['nome', 'nome', true],
                        ['email', 'email', true],
                        ['telefone', 'telefone/contact_phone', true],
                        ['situacao', 'situacao', true],
                        ['plano', 'plano', true],
                        ['data_vencimento', 'data_vencimento', true],
                        ['data_contratacao', 'data_contratacao', true],
                        ['valor_pago', 'valor_pago', true],
                        ['cliente_ativo', 'cliente_ativo', true],
                        ['usuario_m3u', 'usuario_m3u', true],
                        ['senha_m3u', 'senha_m3u', true],
                        ['user_id', 'user_id', true],
                      ].map(([from, to, exists]) => (
                        <TableRow key={from as string}>
                          <TableCell className="font-mono text-sm">{from}</TableCell>
                          <TableCell>→</TableCell>
                          <TableCell className="font-mono text-sm">{to}</TableCell>
                          <TableCell>
                            {exists ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
