# 🎯 Setup Sistema M3U Personalizado com CDN

## ⚠️ PASSO OBRIGATÓRIO - Configurar CDN

### Opção 1: Cloudflare R2 (Recomendado - Mais Barato)

1. **Criar conta Cloudflare** (se ainda não tiver)
   - Acesse: https://dash.cloudflare.com

2. **Ativar Cloudflare R2**
   - Dashboard → R2 → Get Started
   - Criar bucket: `iptvlink-cdn`

3. **Gerar Access Keys**
   - R2 → Manage R2 API Tokens
   - Criar novo token com permissões de leitura/escrita
   - Anotar: `Access Key ID` e `Secret Access Key`

4. **Configurar domínio público**
   - R2 → Settings → Custom Domains
   - Adicionar: `cdn.seudominio.com.br`

5. **Adicionar secrets no Supabase**

Execute no terminal ou via Supabase Dashboard:

```bash
# Via Supabase CLI
supabase secrets set R2_ACCOUNT_ID="seu_account_id"
supabase secrets set R2_ACCESS_KEY_ID="sua_access_key"
supabase secrets set R2_SECRET_ACCESS_KEY="sua_secret_key"
supabase secrets set R2_BUCKET_NAME="iptvlink-cdn"
supabase secrets set R2_PUBLIC_DOMAIN="cdn.seudominio.com.br"
```

**Custo estimado:** ~$0.01/mês para 50 clientes

---

### Opção 2: Amazon S3 + CloudFront

1. **Criar bucket S3**
   - Console AWS → S3 → Create bucket
   - Nome: `iptvlink-cdn`
   - Região: `us-east-1`
   - Desabilitar "Block all public access"

2. **Configurar CloudFront**
   - Console AWS → CloudFront → Create distribution
   - Origin: bucket S3 criado
   - Anotar URL da distribuição

3. **Criar IAM User**
   - Console AWS → IAM → Users → Add user
   - Permissões: `AmazonS3FullAccess`
   - Gerar Access Keys

4. **Adicionar secrets no Supabase**

```bash
supabase secrets set S3_REGION="us-east-1"
supabase secrets set S3_ACCESS_KEY_ID="sua_access_key"
supabase secrets set S3_SECRET_ACCESS_KEY="sua_secret_key"
supabase secrets set S3_BUCKET_NAME="iptvlink-cdn"
supabase secrets set S3_PUBLIC_URL="https://d123abc.cloudfront.net"
```

**Custo estimado:** ~$0.07/mês para 50 clientes

---

## 🔧 Configurar Atualização Diária Automática

Execute o SQL no Supabase SQL Editor:

```sql
-- Ativar pg_cron (se ainda não ativado)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Agendar regeneração diária às 03:00 AM
SELECT cron.schedule(
  'daily-m3u-regeneration',
  '0 3 * * *', -- 03:00 AM todos os dias
  $$
  SELECT net.http_post(
    url:='https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/daily-m3u-regeneration',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkdnl4ZGdoeHFtbnR5b3dlcWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMzMxNTAsImV4cCI6MjA3ODYwOTE1MH0.60t5M81zC_UI5qr3Pfjy0Pa2AKqglMQu7RLmE0K2iak"}'::jsonb
  ) as request_id;
  $$
);
```

**Verificar jobs agendados:**

```sql
SELECT * FROM cron.job;
```

---

## ✅ Fluxo de Uso

### 1. Criar Lista Personalizada

1. Acesse: `/admin/m3u-custom-builder`
2. Clique: "Nova Lista Personalizada"
3. Preencha:
   - Nome: "Premium Esportes"
   - Slug: "premium-esportes"
   - Descrição: "Lista com canais esportivos em HD"

### 2. Adicionar Categorias

1. Adicione categorias:
   - Esportes
   - Filmes HD
   - Séries
   - Documentários

### 3. Adicionar Canais

Para cada categoria, adicione canais:
- Nome do canal
- Logo (URL)
- Stream URL
- Ordem de exibição

### 4. Gerar e Publicar

1. Clique: "Gerar e Publicar"
2. Sistema:
   - Gera arquivo M3U
   - Faz upload para CDN
   - Retorna URL pública
3. URL gerada: `https://cdn.seudominio.com.br/playlists/premium-esportes.m3u`

### 5. Atribuir aos Clientes

1. Ao cadastrar cliente, selecione a lista personalizada
2. Cliente recebe a URL CDN
3. URL funciona em qualquer IPTV player

### 6. Importar M3U Existente (Opcional)

1. Clique: "Importar M3U"
2. Cole URL da lista atual
3. Sistema faz parse automático
4. Selecione quais categorias/canais quer importar
5. Personalize nomes e ordem
6. Salve e publique

---

## 📊 Monitoramento

Acesse `/admin/m3u-custom-dashboard` para ver:

- Total de listas criadas
- Total de canais
- Bandwidth consumido
- Última atualização
- Logs de geração
- Listas mais acessadas

---

## 🔍 Troubleshooting

### Erro: "Lista sem categorias"
**Solução:** Adicione pelo menos uma categoria antes de gerar

### Erro: "Erro ao fazer upload CDN"
**Solução:** Verifique se os secrets do R2/S3 foram configurados corretamente

### Erro: "URL CDN não funciona"
**Solução:** 
1. Verifique se o bucket está público
2. Confirme se o domínio customizado está configurado
3. Aguarde propagação DNS (até 24h)

### Regeneração não está executando
**Solução:**
1. Verifique se o cron job está ativo: `SELECT * FROM cron.job`
2. Confirme se pg_cron está habilitado
3. Verifique logs: `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10`

---

## 💡 Dicas

1. **Organize por público-alvo:**
   - Lista "Família" com canais infantis e educativos
   - Lista "Premium" com canais HD e 4K
   - Lista "Esportes" focada em conteúdo esportivo

2. **Nomeie de forma clara:**
   - Use slugs descritivos: `familia-basica`, `premium-4k`, `esportes-hd`
   - URLs ficam mais profissionais

3. **Teste antes de publicar:**
   - Valide streams antes de ativar lista
   - Use função "Testar Todos os Canais"
   - Remova canais offline

4. **Mantenha organizado:**
   - Use ordem lógica nas categorias
   - Agrupe canais similares
   - Remova duplicatas

5. **Monitore uso:**
   - Acompanhe dashboard semanalmente
   - Identifique listas mais populares
   - Ajuste conteúdo com base em demanda

---

## 🚀 Próximos Passos

Após setup completo:

1. ✅ Criar primeira lista personalizada
2. ✅ Importar conteúdo existente
3. ✅ Gerar e testar URL CDN
4. ✅ Atribuir a clientes de teste
5. ✅ Validar em diferentes players IPTV
6. ✅ Ativar regeneração automática
7. ✅ Monitorar performance

---

## 📞 Suporte

Qualquer dúvida na implementação:
- Verifique logs no Supabase Dashboard
- Consulte documentação Cloudflare R2 ou AWS S3
- Teste funções manualmente via Supabase Functions

**Sistema pronto para produção após setup do CDN! 🎉**
