/**
 * Admin Self-Hosted Management Page
 * Complete management for Self-Hosted Supabase via Coolify
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { SelfHostedDeploymentPanel } from '@/components/admin/SelfHostedDeploymentPanel';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Server, Rocket, Settings, Terminal } from 'lucide-react';

const AdminSelfHostedPage = () => {
  const { user, isMaster } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('deployment');

  useEffect(() => {
    // Only master users can access this page
    if (user && !isMaster) {
      navigate('/admin/dashboard');
    }
  }, [user, isMaster, navigate]);

  if (!user || !isMaster) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Acesso restrito a usuários master.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="mb-6">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/admin/dashboard')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar ao Dashboard
        </Button>
        
        <div className="flex items-center gap-3 mb-2">
          <Server className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Self-Hosted Management</h1>
            <p className="text-muted-foreground">
              Supabase Self-Hosted via Coolify • https://supabase.iptvlink.com.br
            </p>
          </div>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full max-w-xl">
          <TabsTrigger value="deployment" className="flex items-center gap-2">
            <Rocket className="h-4 w-4" />
            <span className="hidden sm:inline">Deployment</span>
          </TabsTrigger>
          <TabsTrigger value="commands" className="flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            <span className="hidden sm:inline">Commands</span>
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Config</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="deployment">
          <SelfHostedDeploymentPanel />
        </TabsContent>

        <TabsContent value="commands">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5" />
                Comandos de Deploy Manual
              </CardTitle>
              <CardDescription>
                Comandos para deploy manual via SSH ou Coolify Terminal
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <h3 className="font-semibold">1. Conectar ao servidor via SSH</h3>
                <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                  {`ssh root@srv1182856.hstgr.cloud`}
                </pre>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold">2. Navegar até o diretório do Supabase</h3>
                <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                  {`cd /data/coolify/services/supabase`}
                </pre>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold">3. Copiar Edge Functions para o volume</h3>
                <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                  {`# Clone ou atualize o repositório
git clone https://github.com/seu-usuario/seu-repo.git /tmp/repo
# Ou se já existe:
cd /tmp/repo && git pull

# Copiar as functions
cp -r /tmp/repo/supabase/functions/* /data/coolify/volumes/functions/`}
                </pre>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold">4. Reiniciar o Edge Runtime</h3>
                <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                  {`# Via Docker Compose
docker compose restart edge-runtime

# Ou via Coolify Dashboard:
# Dashboard → Services → Edge Runtime → Restart`}
                </pre>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold">5. Verificar logs</h3>
                <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                  {`docker compose logs -f edge-runtime --tail=100`}
                </pre>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold">6. Testar uma função</h3>
                <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                  {`curl -X POST https://supabase.iptvlink.com.br/functions/v1/health-check \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..." \\
  -d '{"test": true}'`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Configuração do docker-compose.yml</CardTitle>
                <CardDescription>
                  Adicione este serviço ao docker-compose do Supabase no Coolify
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
                  {`# Edge Functions Service
edge-runtime:
  image: supabase/edge-runtime:v1.67.4
  restart: unless-stopped
  depends_on:
    - kong
  environment:
    JWT_SECRET: \${JWT_SECRET}
    SUPABASE_URL: https://supabase.iptvlink.com.br
    SUPABASE_ANON_KEY: \${ANON_KEY}
    SUPABASE_SERVICE_ROLE_KEY: \${SERVICE_ROLE_KEY}
    SUPABASE_DB_URL: postgresql://postgres:\${POSTGRES_PASSWORD}@db:5432/postgres
    # Secrets for integrations
    MERCADO_PAGO_ACCESS_TOKEN: \${MERCADO_PAGO_ACCESS_TOKEN}
    MERCADO_PAGO_WEBHOOK_SECRET: \${MERCADO_PAGO_WEBHOOK_SECRET}
    WHATSAPP_APPKEY: \${WHATSAPP_APPKEY}
    WHATSAPP_AUTHKEY: \${WHATSAPP_AUTHKEY}
    WHATSAPP_WEBHOOK_SECRET: \${WHATSAPP_WEBHOOK_SECRET}
    R2_ACCESS_KEY_ID: \${R2_ACCESS_KEY_ID}
    R2_SECRET_ACCESS_KEY: \${R2_SECRET_ACCESS_KEY}
    R2_BUCKET_NAME: \${R2_BUCKET_NAME}
    R2_ACCOUNT_ID: \${R2_ACCOUNT_ID}
    R2_PUBLIC_DOMAIN: \${R2_PUBLIC_DOMAIN}
    CLOUDFLARE_ACCOUNT_ID: \${CLOUDFLARE_ACCOUNT_ID}
    CLOUDFLARE_STREAM_API_TOKEN: \${CLOUDFLARE_STREAM_API_TOKEN}
    TMDB_API_KEY: \${TMDB_API_KEY}
    CRON_SECRET: \${CRON_SECRET}
    COOLIFY_API_TOKEN: \${COOLIFY_API_TOKEN}
  command:
    - start
    - --main-service
    - /home/deno/functions/main
  volumes:
    - ./volumes/functions:/home/deno/functions:Z
  networks:
    - supabase`}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Variáveis de Ambiente Necessárias</CardTitle>
                <CardDescription>
                  Configure estas variáveis no Coolify → Service → Environment
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
                  {`# Supabase Core
JWT_SECRET=seu-jwt-secret-aqui
ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
POSTGRES_PASSWORD=sua-senha-postgres

# MercadoPago
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-xxxx
MERCADO_PAGO_WEBHOOK_SECRET=xxx

# WhatsApp
WHATSAPP_APPKEY=xxx
WHATSAPP_AUTHKEY=xxx
WHATSAPP_WEBHOOK_SECRET=xxx

# Cloudflare R2
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=iptvlink-cdn
R2_ACCOUNT_ID=xxx
R2_PUBLIC_DOMAIN=cdn.iptvlink.com.br

# Cloudflare Stream
CLOUDFLARE_ACCOUNT_ID=xxx
CLOUDFLARE_STREAM_API_TOKEN=xxx

# APIs Externas
TMDB_API_KEY=xxx
CRON_SECRET=xxx
COOLIFY_API_TOKEN=xxx`}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Kong Gateway Configuration</CardTitle>
                <CardDescription>
                  Adicione estas rotas ao kong.yml para expor as Edge Functions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
                  {`# kong.yml - adicionar ao final
- name: functions
  url: http://edge-runtime:9000
  routes:
    - name: functions-all
      strip_path: true
      paths:
        - /functions/v1/
  plugins:
    - name: cors
    - name: key-auth
      config:
        hide_credentials: false`}
                </pre>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSelfHostedPage;
