/**
 * Xtream Codes M3U Import Form
 * Allows importing channels from full M3U URL format:
 * http://<server>:<port>/get.php?username=<user>&password=<pass>&type=m3u_plus&output=ts
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Download, Server, User, Lock, Globe } from 'lucide-react';

const xtreamSchema = z.object({
  serverUrl: z.string().min(1, 'URL do servidor é obrigatória'),
  port: z.string().min(1, 'Porta é obrigatória').regex(/^\d+$/, 'Porta deve ser numérica'),
  username: z.string().min(1, 'Usuário é obrigatório'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

type XtreamFormData = z.infer<typeof xtreamSchema>;

interface XtreamImportFormProps {
  onImportComplete?: (count: number) => void;
}

export function XtreamImportForm({ onImportComplete }: XtreamImportFormProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<XtreamFormData>({
    resolver: zodResolver(xtreamSchema),
    defaultValues: {
      serverUrl: '',
      port: '8880',
      username: '',
      password: '',
    },
  });

  const buildM3UUrl = (data: XtreamFormData): string => {
    // Remove protocol if present
    let server = data.serverUrl.trim();
    server = server.replace(/^https?:\/\//, '');
    server = server.replace(/\/$/, '');

    return `http://${server}:${data.port}/get.php?username=${encodeURIComponent(data.username)}&password=${encodeURIComponent(data.password)}&type=m3u_plus&output=ts`;
  };

  const onSubmit = async (data: XtreamFormData) => {
    setIsImporting(true);
    setProgress('Construindo URL...');

    try {
      const m3uUrl = buildM3UUrl(data);
      console.log('[XtreamImport] M3U URL:', m3uUrl);

      setProgress('Conectando ao servidor Xtream...');

      // Call fetch-m3u edge function
      const { data: response, error } = await supabase.functions.invoke('fetch-m3u', {
        body: {
          url: m3uUrl,
          sourceId: `xtream-${data.username}`,
          sourceName: `Xtream: ${data.serverUrl}`,
        },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao importar');
      }

      if (response?.mode === 'streaming') {
        // Large file processed in streaming mode
        toast({
          title: 'Importação concluída',
          description: `${response.insertedCount || 0} canais importados com sucesso`,
        });
        onImportComplete?.(response.insertedCount || 0);
      } else if (response?.success) {
        toast({
          title: 'Importação concluída',
          description: `${response.count || 0} canais importados`,
        });
        onImportComplete?.(response.count || 0);
      } else {
        throw new Error(response?.error || 'Erro desconhecido');
      }
    } catch (error) {
      console.error('[XtreamImport] Error:', error);
      toast({
        title: 'Erro na importação',
        description: error instanceof Error ? error.message : 'Erro ao importar canais',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
      setProgress(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Importar via Xtream Codes
        </CardTitle>
        <CardDescription>
          Importe canais usando as credenciais do servidor Xtream Codes
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="serverUrl" className="flex items-center gap-2">
                <Server className="h-4 w-4" />
                Servidor
              </Label>
              <Input
                id="serverUrl"
                placeholder="exemplo: 192.168.1.100 ou servidor.com"
                {...register('serverUrl')}
                disabled={isImporting}
              />
              {errors.serverUrl && (
                <p className="text-sm text-destructive">{errors.serverUrl.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="port">Porta</Label>
              <Input
                id="port"
                placeholder="8880"
                {...register('port')}
                disabled={isImporting}
              />
              {errors.port && (
                <p className="text-sm text-destructive">{errors.port.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Usuário
              </Label>
              <Input
                id="username"
                placeholder="username"
                {...register('username')}
                disabled={isImporting}
              />
              {errors.username && (
                <p className="text-sm text-destructive">{errors.username.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="password"
                {...register('password')}
                disabled={isImporting}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
          </div>

          <Button type="submit" disabled={isImporting} className="w-full">
            {isImporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {progress || 'Importando...'}
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Importar Canais
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
