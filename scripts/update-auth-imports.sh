#!/bin/bash

# Script para atualizar todos os imports de autenticação para o novo contexto unificado

echo "Atualizando imports de autenticação..."

# Lista de arquivos para atualizar
FILES=(
  "src/pages/AdminClienteForm.tsx"
  "src/pages/AdminClientes.tsx"
  "src/pages/AdminCustomize.tsx"
  "src/pages/AdminM3ULists.tsx"
  "src/pages/AdminNotificacoes.tsx"
  "src/pages/AdminSmartOneConfig.tsx"
  "src/pages/AdminSmartOneSync.tsx"
  "src/pages/AdminUserRoles.tsx"
  "src/pages/AppLogin.tsx"
  "src/pages/ClienteSettings.tsx"
  "src/pages/ClienteSubscription.tsx"
)

# Substituir useSupabaseAuth por useAuth
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "Atualizando $file..."
    sed -i "s|from '@/hooks/useSupabaseAuth'|from '@/contexts/AuthContext'|g" "$file"
    sed -i "s|useSupabaseAuth|useAuth|g" "$file"
  fi
done

# Atualizar AppHome.tsx (usa useAppAuth - caso especial)
if [ -f "src/pages/AppHome.tsx" ]; then
  echo "Atualizando AppHome.tsx..."
  sed -i "s|from '@/hooks/useAppAuth'|from '@/contexts/AuthContext'|g" "src/pages/AppHome.tsx"
  sed -i "s|useAppAuth|useAuth|g" "src/pages/AppHome.tsx"
fi

echo "Atualização concluída!"
