# 📦 DEPRECATION NOTES

## Data: 2025-11-29
## Autor: lovable-agent
## Motivo: Consolidação de arquitetura admin

---

## Arquivos Deprecados

### Páginas Admin Órfãs (rotas redirecionam para consolidadas)

| Arquivo | Data | Motivo | Redireciona para |
|---------|------|--------|------------------|
| - | - | - | - |

**Nota:** Os arquivos ainda NÃO foram movidos. Esta pasta existe para receber arquivos após aprovação do QA.

---

## Processo de Deprecação

1. **Identificar** arquivo como candidato
2. **Verificar** se não há imports ativos
3. **Mover** para `deprecated/pages/`
4. **Aguardar** 7-14 dias
5. **Deletar** após confirmação

---

## Arquivos NÃO devem ser deprecados

- Qualquer arquivo importado por páginas ativas
- Arquivos de configuração
- Tipos/interfaces usados globalmente
- Services ativos

---

## Rollback

Para restaurar um arquivo deprecado:
```bash
git checkout HEAD~1 -- deprecated/pages/<arquivo>
mv deprecated/pages/<arquivo> src/pages/<arquivo>
```
