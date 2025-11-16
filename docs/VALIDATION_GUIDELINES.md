# Guia de Validações do Sistema

Este documento descreve as validações implementadas em todos os formulários do sistema.

## 📋 Validações Globais

### Telefone
- **Formato**: Brasileiro (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
- **Mínimo**: 10 dígitos
- **Máximo**: 15 dígitos
- **Componente**: `PhoneInput` com máscara automática
- **Validação**: Apenas números são salvos no banco

```tsx
<PhoneInput
  value={telefone}
  onChange={(value) => setTelefone(value)}
  mask="brazilian"
  placeholder="(11) 99999-9999"
/>
```

### Email
- **Formato**: RFC 5322 compliant
- **Máximo**: 255 caracteres
- **Validação**: `z.string().trim().email().max(255)`

### Nome
- **Mínimo**: 3 caracteres (cadastro) ou 1 caractere (admin)
- **Máximo**: 200 caracteres
- **Formato**: Apenas letras e espaços (admin)
- **Validação**: `z.string().trim().min(3).max(200)`

### Senha
- **Mínimo**: 6 caracteres
- **Máximo**: 100 caracteres
- **Proteção**: Validação HIBP (Have I Been Pwned) no signup
- **Componente**: `PasswordStrengthIndicator` para feedback visual

### MAC Address
- **Formato**: XX:XX:XX:XX:XX:XX (hexadecimal)
- **Regex**: `/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$|^$/`
- **Máximo**: 17 caracteres
- **Auto-formatação**: Converte para maiúsculas e adiciona `:` automaticamente

## 📅 Componente DatePicker

### Uso Básico
```tsx
import { DatePicker } from '@/components/ui/date-picker';
import { format, parseISO } from 'date-fns';

<DatePicker
  date={dataContratacao ? parseISO(dataContratacao) : undefined}
  onDateChange={(date) => setDataContratacao(date ? format(date, 'yyyy-MM-dd') : '')}
  placeholder="Selecione a data de contratação"
  disableFuture // Opcional: desabilita datas futuras
  disablePast   // Opcional: desabilita datas passadas
/>
```

### Propriedades
- `date`: Date | undefined - Data selecionada
- `onDateChange`: (date: Date | undefined) => void - Callback ao selecionar
- `placeholder`: string - Texto quando nenhuma data está selecionada
- `disabled`: boolean - Desabilita o componente
- `disableFuture`: boolean - Não permite datas futuras
- `disablePast`: boolean - Não permite datas passadas
- `className`: string - Classes CSS adicionais

## 📱 Componente PhoneInput

### Uso Básico
```tsx
import { PhoneInput } from '@/components/ui/phone-input';

<PhoneInput
  value={telefone}
  onChange={(value) => setTelefone(value)}
  mask="brazilian"     // 'brazilian' | 'international' | 'none'
  placeholder="(11) 99999-9999"
/>
```

### Máscaras Disponíveis
1. **brazilian**: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
2. **international**: +XX (XX) XXXXX-XXXX
3. **none**: Apenas números sem formatação

### Comportamento
- Aceita apenas números durante digitação
- Aplica máscara visual automaticamente
- Retorna apenas números no `onChange` (sem máscara)
- Formata enquanto o usuário digita

## 🔐 Validações de Segurança

### Campos que DEVEM ter validação XSS
- Nome
- Email
- Telefone
- Endereços MAC
- Qualquer campo de texto livre

### Exemplo de Schema Seguro
```typescript
const clienteSchema = z.object({
  nome: z.string()
    .trim()
    .min(1, 'Nome é obrigatório')
    .max(200, 'Nome muito longo')
    .regex(/^[a-zA-ZÀ-ÿ\s]+$/, 'Nome deve conter apenas letras'),
  
  telefone: z.string()
    .trim()
    .min(10, 'Telefone inválido')
    .max(15, 'Telefone inválido'),
  
  email: z.string()
    .trim()
    .email('Email inválido')
    .max(255, 'Email muito longo'),
});
```

## 📝 Formulários Atualizados

### AdminClienteForm
- ✅ PhoneInput com máscara brasileira
- ✅ DatePicker para datas de contratação, vencimento e último pagamento
- ✅ Validação Zod completa
- ✅ Feedback de erro em tempo real

### ClienteCadastro
- ✅ PhoneInput com máscara brasileira
- ✅ PasswordStrengthIndicator
- ✅ Validação HIBP para senhas
- ✅ Auto-formatação de MAC address

### AdminUserRoles
- ✅ DatePicker para filtros de data
- ✅ Formato de data consistente (yyyy-MM-dd)

## 🎨 Design System

### Componentes utilizam tokens do design system
- `bg-popover` para fundos de popovers
- `text-muted-foreground` para labels e placeholders
- `border-border` para bordas
- `z-50` para popovers garantindo sobreposição

### Acessibilidade
- Todos os DatePickers têm `initialFocus` para navegação por teclado
- PhoneInputs têm `type="tel"` para teclados mobile otimizados
- Labels conectadas com `htmlFor` aos inputs correspondentes

## 🔄 Conversão de Formatos

### Date ↔ String
```typescript
// Date para String (para salvar no banco)
const dateString = format(date, 'yyyy-MM-dd');

// String para Date (para exibir no DatePicker)
const date = parseISO(dateString);
```

### Telefone com/sem máscara
```typescript
// Componente PhoneInput automaticamente:
// - Exibe: "(11) 99999-9999"
// - Retorna no onChange: "11999999999"
```

## ⚠️ Pontos de Atenção

1. **Sempre validar no backend também** - Validação client-side é UX, não segurança
2. **Usar `trim()` em todos os strings** - Remove espaços acidentais
3. **Limites de tamanho** - Previne ataques de buffer overflow
4. **Regex específicos** - Valida formato exato esperado
5. **Feedback visual** - Usuário deve saber imediatamente se algo está errado
