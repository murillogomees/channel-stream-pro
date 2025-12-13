#!/bin/bash
# ======================================================
# SCRIPT DE DIAGNÓSTICO KONG - EXECUTE VIA SSH NO VPS
# ======================================================

set -e
echo "=============================================="
echo "   DIAGNÓSTICO KONG - IPTVLink"
echo "=============================================="
echo ""

# 1. Status dos containers
echo "📦 STATUS DOS CONTAINERS SUPABASE:"
echo "----------------------------------------------"
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "supabase|kong|rest|auth|realtime|storage" || true
echo ""

# 2. Verificar rede Docker
echo "🌐 REDE DOCKER (supabase-network):"
echo "----------------------------------------------"
docker network inspect supabase-network --format '{{range .Containers}}{{.Name}} ({{.IPv4Address}}){{"\n"}}{{end}}' 2>/dev/null || echo "Rede não encontrada"
echo ""

# 3. Logs do Kong (últimas 30 linhas)
echo "📋 LOGS DO KONG (últimas 30 linhas):"
echo "----------------------------------------------"
docker logs supabase-kong --tail 30 2>&1 || echo "Container kong não encontrado"
echo ""

# 4. Configuração atual do Kong
echo "⚙️ CONFIGURAÇÃO DO KONG (kong.yml):"
echo "----------------------------------------------"
docker exec supabase-kong cat /usr/local/kong/declarative/kong.yml 2>&1 | head -150 || echo "Falha ao ler kong.yml"
echo ""

# 5. Rotas do Kong via Admin API
echo "🛤️ ROTAS DO KONG (Admin API localhost:8001):"
echo "----------------------------------------------"
docker exec supabase-kong curl -s http://localhost:8001/routes 2>&1 | head -100 || echo "Admin API não acessível"
echo ""

# 6. Services do Kong via Admin API
echo "🔌 SERVICES DO KONG (Admin API):"
echo "----------------------------------------------"
docker exec supabase-kong curl -s http://localhost:8001/services 2>&1 | head -100 || echo "Admin API não acessível"
echo ""

# 7. Teste de conectividade interna do Kong para PostgREST
echo "🔗 TESTE: Kong → PostgREST (supabase-rest:3000):"
echo "----------------------------------------------"
docker exec supabase-kong curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://supabase-rest:3000/ 2>&1 || echo "Falha na conexão"
echo ""

# 8. Teste de conectividade interna do Kong para Auth
echo "🔗 TESTE: Kong → Auth (supabase-auth:9999):"
echo "----------------------------------------------"
docker exec supabase-kong curl -s http://supabase-auth:9999/health 2>&1 || echo "Falha na conexão"
echo ""

# 9. Logs do Storage (restart loop)
echo "📋 LOGS DO STORAGE (últimas 20 linhas):"
echo "----------------------------------------------"
docker logs supabase-storage --tail 20 2>&1 || echo "Container storage não encontrado"
echo ""

# 10. Variáveis de ambiente relevantes do Kong
echo "🔑 VARIÁVEIS DO KONG:"
echo "----------------------------------------------"
docker exec supabase-kong printenv | grep -E "KONG|SUPABASE|API|URL" 2>&1 || echo "Falha ao ler variáveis"
echo ""

echo "=============================================="
echo "   DIAGNÓSTICO COMPLETO"
echo "=============================================="
echo ""
echo "👉 Copie a saída acima e cole no chat para análise."
