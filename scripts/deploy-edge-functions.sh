#!/bin/bash
# Script para deploy das Edge Functions no Supabase Self-Hosted via Coolify
# Execute com: bash deploy-edge-functions.sh

set -e

echo "🚀 Iniciando deploy das Edge Functions..."

# Configurações
FUNCTIONS_DIR="/data/coolify/services"
REPO_URL="https://github.com/AcessoAI/tv-acessoai-hub.git"
TEMP_DIR="/tmp/lovable-functions"

# Limpar diretório temporário
rm -rf $TEMP_DIR
mkdir -p $TEMP_DIR

echo "📥 Clonando repositório..."
git clone --depth 1 $REPO_URL $TEMP_DIR

# Encontrar o diretório do edge-runtime
echo "🔍 Localizando edge-runtime..."
EDGE_RUNTIME_VOLUME=$(find /data/coolify -type d -name "functions" 2>/dev/null | head -1)

if [ -z "$EDGE_RUNTIME_VOLUME" ]; then
    # Tentar encontrar pelo container
    CONTAINER_ID=$(docker ps -q --filter "name=edge-runtime" --filter "name=functions" 2>/dev/null | head -1)
    if [ -n "$CONTAINER_ID" ]; then
        echo "📦 Container encontrado: $CONTAINER_ID"
        # Copiar diretamente para o container
        docker cp $TEMP_DIR/supabase/functions/. $CONTAINER_ID:/home/deno/functions/
        echo "✅ Funções copiadas para o container"
        docker restart $CONTAINER_ID
        echo "🔄 Container reiniciado"
    else
        echo "❌ Não foi possível encontrar o edge-runtime"
        echo "Tentando criar diretório padrão..."
        mkdir -p /root/supabase/docker/volumes/functions
        EDGE_RUNTIME_VOLUME="/root/supabase/docker/volumes/functions"
    fi
else
    echo "📁 Volume encontrado: $EDGE_RUNTIME_VOLUME"
fi

if [ -n "$EDGE_RUNTIME_VOLUME" ]; then
    echo "📋 Copiando funções..."
    cp -r $TEMP_DIR/supabase/functions/* $EDGE_RUNTIME_VOLUME/
    echo "✅ Funções copiadas para: $EDGE_RUNTIME_VOLUME"
    
    # Listar funções instaladas
    echo ""
    echo "📦 Funções instaladas:"
    ls -la $EDGE_RUNTIME_VOLUME/
fi

# Reiniciar edge-runtime via Docker
echo ""
echo "🔄 Reiniciando edge-runtime..."
CONTAINER_ID=$(docker ps -q --filter "name=edge-runtime" 2>/dev/null | head -1)
if [ -z "$CONTAINER_ID" ]; then
    CONTAINER_ID=$(docker ps -q --filter "name=functions" 2>/dev/null | head -1)
fi

if [ -n "$CONTAINER_ID" ]; then
    docker restart $CONTAINER_ID
    echo "✅ Container $CONTAINER_ID reiniciado"
else
    echo "⚠️ Container não encontrado. Reinicie manualmente via Coolify."
fi

# Limpar
rm -rf $TEMP_DIR

echo ""
echo "🎉 Deploy concluído!"
echo ""
echo "📋 Próximos passos:"
echo "1. Verifique os logs do edge-runtime no Coolify"
echo "2. Configure as variáveis de ambiente necessárias:"
echo "   - SELFHOSTED_DB_URL=postgresql://postgres:SENHA@db:5432/postgres"
echo "   - JWT_SECRET=seu-jwt-secret"
echo "   - SUPABASE_URL=https://supabase.iptvlink.com.br"
echo "   - SUPABASE_ANON_KEY=eyJ0eXAi..."
echo "   - SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAi..."
echo ""
echo "3. Teste com: curl https://supabase.iptvlink.com.br/functions/v1/custom-auth"
