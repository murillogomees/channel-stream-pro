# Segurança do Sistema

## Visão Geral

Este documento descreve as medidas de segurança implementadas no sistema offline de gerenciamento de clientes.

## Autenticação

### Armazenamento Seguro
- **Sessões**: Armazenadas em `sessionStorage` com criptografia XOR
- **Tokens**: Gerados usando `crypto.getRandomValues()` para aleatoriedade criptográfica
- **Senhas**: Hash SHA-256 com salt único

### Proteções de Login
1. **Rate Limiting**: Máximo de 5 tentativas de login em 15 minutos
2. **Bloqueio Temporário**: 15 minutos após 5 tentativas falhas
3. **Validação de Email**: Formato e tamanho validados
4. **Validação de Senha**: 
   - Mínimo 8 caracteres
   - Máximo 128 caracteres
   - Requer: maiúscula, minúscula e número

### Expiração de Sessão
- **Tempo de inatividade**: 30 minutos
- **Validade máxima**: 8 horas
- **Verificação periódica**: A cada 1 minuto

## Validação de Entrada

### Sanitização
Todos os inputs de usuário são sanitizados para prevenir:
- **XSS (Cross-Site Scripting)**: Remoção de caracteres HTML perigosos (`<>"'`)
- **Injeção de código**: Validação de formato e tipo
- **Overflow**: Limites de tamanho em todos os campos

### Campos e Limites
| Campo | Tamanho Máximo | Validação Adicional |
|-------|----------------|---------------------|
| Nome | 200 caracteres | Remove HTML |
| Email | 255 caracteres | Formato válido + lowercase |
| Telefone | 20 caracteres | Apenas números e símbolos |
| Telegram | 50 caracteres | Remove HTML |
| MAC Address | 100 caracteres | Apenas hex e separadores |
| Valor Pago | 999999.99 | Não negativo |
| Observações | 2000 caracteres | Remove HTML |

## Proteção de Dados

### Criptografia
- **Sessões**: XOR cipher para ofuscação básica
- **Senhas**: SHA-256 com salt
- **Dados sensíveis**: Nunca armazenados em texto puro

### Estrutura de Dados
```typescript
{
  token: string;        // Token único da sessão
  userId: string;       // ID do usuário
  email: string;        // Email sanitizado
  nome: string;         // Nome do usuário
  expiresAt: number;    // Timestamp de expiração
  lastActivity: number; // Timestamp da última atividade
}
```

## Boas Práticas

### Desenvolvedor
1. Nunca adicione `console.log()` com dados sensíveis
2. Valide todas as entradas antes de processar
3. Use tipos TypeScript para garantir estrutura de dados
4. Mantenha bibliotecas atualizadas

### Administrador
1. Use senhas fortes (mínimo 8 caracteres com complexidade)
2. Faça logout ao sair do sistema
3. Não compartilhe credenciais
4. Não deixe sessões abertas em computadores públicos

## Limitações

### Sistema Offline
- Não possui proteção contra ataques físicos ao dispositivo
- Dados em `sessionStorage` podem ser acessados por outras abas do mesmo domínio
- Criptografia XOR é básica e não substitui TLS/SSL

### Recomendações Futuras
Para ambiente de produção, considere:
1. Backend real com autenticação JWT
2. HTTPS obrigatório
3. 2FA (autenticação de dois fatores)
4. Criptografia AES para dados sensíveis
5. Auditoria de acesso
6. Backup criptografado

## Resposta a Incidentes

### Em caso de suspeita de comprometimento:
1. Force logout de todas as sessões (limpe `sessionStorage`)
2. Altere senhas dos administradores
3. Revise logs de acesso
4. Atualize hash das senhas em `admins.json`

## Atualizações de Segurança

**Última revisão**: Janeiro 2025
**Próxima revisão recomendada**: Abril 2025

### Histórico
- v1.0 (Jan 2025): Implementação inicial de segurança offline
  - Rate limiting
  - Validação de entrada
  - Criptografia de sessão
  - Proteção XSS
