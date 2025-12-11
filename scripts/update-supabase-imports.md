# Migração de Imports Supabase para Self-Hosted

## Progresso Atual
- ✅ Criado novo cliente self-hosted em `src/lib/supabase.ts`
- ✅ Configuração apontando para `https://supabase.iptvlink.com.br`
- ✅ Atualizados ~25 arquivos principais

## Arquivos Restantes (~67 arquivos)
Execute no terminal para substituir todos os imports restantes:

```bash
# No diretório do projeto, execute:
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '@/integrations/supabase/client'|from '@/lib/supabase'|g"
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from "@/integrations/supabase/client"|from "@/lib/supabase"|g'
```

Ou no Windows PowerShell:
```powershell
Get-ChildItem -Path src -Recurse -Include *.ts,*.tsx | ForEach-Object {
    (Get-Content $_.FullName) -replace "from '@/integrations/supabase/client'", "from '@/lib/supabase'" | Set-Content $_.FullName
}
```

## Configuração Self-Hosted
O arquivo `src/config/supabase.ts` contém:
- URL: `https://supabase.iptvlink.com.br`
- Anon Key configurada

## Verificação
Após a substituição, execute `npm run build` para verificar se não há erros.
