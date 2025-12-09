import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, Server, Key, Database, Loader2 } from 'lucide-react';

interface InstanceFormProps {
  onSubmit: (data: {
    name: string;
    supabase_url: string;
    service_role_key: string;
    anon_key?: string;
    pg_host?: string;
    pg_port?: number;
  }) => Promise<boolean>;
  loading?: boolean;
}

export function InstanceForm({ onSubmit, loading }: InstanceFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    supabase_url: '',
    service_role_key: '',
    anon_key: '',
    pg_host: '',
    pg_port: '5432',
  });
  const [showServiceKey, setShowServiceKey] = useState(false);
  const [showAnonKey, setShowAnonKey] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    const success = await onSubmit({
      name: formData.name,
      supabase_url: formData.supabase_url,
      service_role_key: formData.service_role_key,
      anon_key: formData.anon_key || undefined,
      pg_host: formData.pg_host || undefined,
      pg_port: formData.pg_port ? parseInt(formData.pg_port) : undefined,
    });

    if (success) {
      setFormData({
        name: '',
        supabase_url: '',
        service_role_key: '',
        anon_key: '',
        pg_host: '',
        pg_port: '5432',
      });
    }
    setSubmitting(false);
  };

  const isLoading = loading || submitting;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="h-5 w-5" />
          Nova Instância
        </CardTitle>
        <CardDescription>
          Cadastre uma instância Supabase self-hosted para gerenciamento
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nome */}
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Instância *</Label>
              <Input
                id="name"
                placeholder="Produção Principal"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            {/* URL */}
            <div className="space-y-2">
              <Label htmlFor="supabase_url">Supabase URL *</Label>
              <Input
                id="supabase_url"
                type="url"
                placeholder="https://seu-servidor.com"
                value={formData.supabase_url}
                onChange={(e) => setFormData({ ...formData, supabase_url: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Service Role Key */}
          <div className="space-y-2">
            <Label htmlFor="service_role_key" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              Service Role Key *
            </Label>
            <div className="relative">
              <Input
                id="service_role_key"
                type={showServiceKey ? 'text' : 'password'}
                placeholder="eyJhbGciOiJIUzI1NiIs..."
                value={formData.service_role_key}
                onChange={(e) => setFormData({ ...formData, service_role_key: e.target.value })}
                className="pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowServiceKey(!showServiceKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showServiceKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              A chave será criptografada antes de ser armazenada
            </p>
          </div>

          {/* Anon Key (opcional) */}
          <div className="space-y-2">
            <Label htmlFor="anon_key" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              Anon Key (opcional)
            </Label>
            <div className="relative">
              <Input
                id="anon_key"
                type={showAnonKey ? 'text' : 'password'}
                placeholder="eyJhbGciOiJIUzI1NiIs..."
                value={formData.anon_key}
                onChange={(e) => setFormData({ ...formData, anon_key: e.target.value })}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowAnonKey(!showAnonKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showAnonKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* PG Host e Port */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pg_host" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Host PostgreSQL (SSH)
              </Label>
              <Input
                id="pg_host"
                placeholder="user@192.168.1.100"
                value={formData.pg_host}
                onChange={(e) => setFormData({ ...formData, pg_host: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Para backup via SSH (ex: root@servidor.com)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pg_port">Porta PostgreSQL</Label>
              <Input
                id="pg_port"
                type="number"
                placeholder="5432"
                value={formData.pg_port}
                onChange={(e) => setFormData({ ...formData, pg_port: e.target.value })}
              />
            </div>
          </div>

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Salvando...
              </>
            ) : (
              'Cadastrar Instância'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
