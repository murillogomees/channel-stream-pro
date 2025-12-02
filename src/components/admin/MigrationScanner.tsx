/**
 * Migration Scanner - Schema Drift Detection
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Wrench,
  Play,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Code,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { migrationAutomationService, DriftFinding } from '@/services/migrationAutomationService';

export function MigrationScanner() {
  const [scanning, setScanning] = useState(false);
  const [findings, setFindings] = useState<DriftFinding[]>([]);
  const [scanId, setScanId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    critical: 0,
    high: 0,
    medium: 0,
    low: 0
  });

  const handleScan = async () => {
    setScanning(true);
    try {
      console.log('[Scanner] Starting drift scan...');
      const result = await migrationAutomationService.scanForDrift();
      
      console.log('[Scanner] Scan result:', result);
      
      setScanId(result.scan_id);
      setFindings(result.findings || []);
      setStats({
        critical: result.summary.critical || 0,
        high: result.summary.high || 0,
        medium: result.summary.medium || 0,
        low: result.summary.low || 0
      });

      if (result.findings.length === 0) {
        toast.success('✅ Nenhum drift detectado - schema está sincronizado');
      } else {
        toast.warning(`⚠️ ${result.findings.length} problemas detectados`);
      }
    } catch (error) {
      console.error('[Scanner] Error:', error);
      toast.error(`Erro ao executar scan: ${error}`);
    } finally {
      setScanning(false);
    }
  };

  const applyFix = async (driftId: string) => {
    try {
      const result = await migrationAutomationService.applyFix(driftId, false);
      
      if (result.success) {
        toast.success('Fix aplicado com sucesso!');
        handleScan(); // Rescan
      } else {
        toast.error(`Erro ao aplicar fix: ${result.error}`);
      }
    } catch (error) {
      console.error('Error applying fix:', error);
      toast.error('Erro ao aplicar correção');
    }
  };

  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, { variant: any; icon: any }> = {
      critical: { variant: 'destructive', icon: XCircle },
      high: { variant: 'destructive', icon: AlertTriangle },
      medium: { variant: 'default', icon: AlertTriangle },
      low: { variant: 'outline', icon: AlertTriangle }
    };

    const config = variants[severity] || variants.low;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {severity.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Wrench className="w-6 h-6" />
            Schema Drift Detection
          </h2>
          <p className="text-muted-foreground">Detecta inconsistências entre schema esperado e atual</p>
        </div>
        <Button onClick={handleScan} disabled={scanning}>
          <Play className={`w-4 h-4 mr-2 ${scanning ? 'animate-pulse' : ''}`} />
          {scanning ? 'Escaneando...' : 'Run Scan'}
        </Button>
      </div>

      {/* Stats */}
      {scanId && (
        <Card>
          <CardHeader>
            <CardTitle>Scan Results</CardTitle>
            <CardDescription className="font-mono text-xs">ID: {scanId}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Badge variant="destructive">{stats.critical} Críticos</Badge>
              <Badge variant="destructive">{stats.high} Altos</Badge>
              <Badge>{stats.medium} Médios</Badge>
              <Badge variant="outline">{stats.low} Baixos</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Findings */}
      {findings.length > 0 ? (
        <div className="space-y-4">
          {findings.map((finding) => (
            <Alert
              key={finding.id}
              variant={finding.severity === 'critical' || finding.severity === 'high' ? 'destructive' : 'default'}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getSeverityBadge(finding.severity)}
                    <Badge variant="outline">{finding.drift_type}</Badge>
                    <code className="text-sm">{finding.object_name}</code>
                  </div>
                  
                  <AlertDescription className="space-y-2">
                    <p><strong>Tipo:</strong> {finding.object_type}</p>
                    
                    {finding.current_state && (
                      <div className="font-mono text-xs bg-muted p-2 rounded">
                        <strong>Estado Atual:</strong>
                        <pre className="mt-1">{finding.current_state}</pre>
                      </div>
                    )}
                    
                    {finding.expected_state && (
                      <div className="font-mono text-xs bg-muted p-2 rounded">
                        <strong>Estado Esperado:</strong>
                        <pre className="mt-1">{finding.expected_state}</pre>
                      </div>
                    )}
                    
                    {finding.fix_sql && (
                      <div className="font-mono text-xs bg-muted p-2 rounded">
                        <strong>Fix SQL:</strong>
                        <pre className="mt-1">{finding.fix_sql}</pre>
                      </div>
                    )}
                  </AlertDescription>
                </div>
                
                {finding.fix_sql && !finding.fix_applied && (
                  <Button
                    size="sm"
                    onClick={() => applyFix(finding.id)}
                    className="ml-4"
                  >
                    <Wrench className="w-3 h-3 mr-1" />
                    Apply Fix
                  </Button>
                )}
                
                {finding.fix_applied && (
                  <Badge className="ml-4">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Aplicado
                  </Badge>
                )}
              </div>
            </Alert>
          ))}
        </div>
      ) : scanId ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="w-12 h-12 text-green-500 mb-4" />
            <p className="text-lg font-medium">Schema Sincronizado!</p>
            <p className="text-sm text-muted-foreground">Nenhum drift detectado</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Wrench className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Nenhum scan executado</p>
            <p className="text-sm text-muted-foreground mb-4">
              Clique em "Run Scan" para detectar inconsistências
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
