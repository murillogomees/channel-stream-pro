/**
 * BackupCodes Component - Generate and manage MFA backup codes
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Key, 
  Loader2, 
  Copy, 
  CheckCircle2,
  Download,
  RefreshCw,
  AlertTriangle,
  Eye,
  EyeOff
} from 'lucide-react';
import { toast } from 'sonner';
import { customAuthService } from '@/services/customAuthService';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface BackupCode {
  code: string;
  used: boolean;
}

export function BackupCodes() {
  const [codes, setCodes] = useState<BackupCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCodes, setShowCodes] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  const generateCodes = async () => {
    setLoading(true);
    try {
      const { data, error } = await customAuthService.generateBackupCodes();
      
      if (error) {
        toast.error(error.message || 'Erro ao gerar códigos');
        return;
      }

      if (data?.codes) {
        setCodes(data.codes.map((code: string) => ({ code, used: false })));
        setHasGenerated(true);
        setShowCodes(true);
        toast.success('Códigos de backup gerados!');
      }
    } catch (e) {
      toast.error('Erro ao gerar códigos de backup');
    } finally {
      setLoading(false);
    }
  };

  const copyAllCodes = () => {
    const codesText = codes.map(c => c.code).join('\n');
    navigator.clipboard.writeText(codesText);
    setCopied(true);
    toast.success('Códigos copiados!');
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadCodes = () => {
    const content = [
      'CÓDIGOS DE BACKUP - IPTV Link',
      '================================',
      'Guarde estes códigos em um local seguro.',
      'Cada código pode ser usado apenas uma vez.',
      '',
      ...codes.map((c, i) => `${i + 1}. ${c.code}`),
      '',
      `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'backup-codes-iptvlink.txt';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Arquivo baixado!');
  };

  const usedCount = codes.filter(c => c.used).length;
  const remainingCount = codes.length - usedCount;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-muted">
              <Key className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-lg">Códigos de Backup</CardTitle>
              <CardDescription>
                Use quando não tiver acesso ao autenticador
              </CardDescription>
            </div>
          </div>
          {hasGenerated && (
            <Badge variant={remainingCount > 3 ? 'default' : 'destructive'}>
              {remainingCount} restantes
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasGenerated ? (
          <div className="text-center py-4">
            <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 mb-4">
              <AlertTriangle className="h-6 w-6 text-yellow-600 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Códigos de backup permitem acessar sua conta caso perca 
                acesso ao seu aplicativo autenticador.
              </p>
            </div>
            <Button onClick={generateCodes} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Key className="h-4 w-4 mr-2" />
              )}
              Gerar Códigos de Backup
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCodes(!showCodes)}
              >
                {showCodes ? (
                  <>
                    <EyeOff className="h-4 w-4 mr-2" />
                    Ocultar
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Mostrar
                  </>
                )}
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyAllCodes}
                  disabled={!showCodes}
                >
                  {copied ? (
                    <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4 mr-2" />
                  )}
                  Copiar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadCodes}
                  disabled={!showCodes}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Baixar
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {codes.map((item, index) => (
                <div
                  key={index}
                  className={`
                    p-2 rounded-md text-center font-mono text-sm border
                    ${item.used 
                      ? 'bg-muted text-muted-foreground line-through opacity-50' 
                      : 'bg-card'
                    }
                  `}
                >
                  {showCodes ? item.code : '••••••••'}
                </div>
              ))}
            </div>

            <div className="pt-4 border-t">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Gerar Novos Códigos
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Gerar novos códigos?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isso irá invalidar todos os códigos anteriores. 
                      Certifique-se de salvar os novos códigos em um local seguro.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={generateCodes}>
                      Gerar Novos
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
