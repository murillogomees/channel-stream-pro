# Component Library Documentation

## Overview

Biblioteca de componentes UI baseada em shadcn/ui com customizações para o projeto IPTVLink.

## Estrutura

```
src/components/
├── ui/           # Componentes base (shadcn)
├── admin/        # Componentes administrativos
├── player/       # Componentes do player
├── common/       # Componentes compartilhados
└── forms/        # Componentes de formulário
```

## Componentes Base (shadcn/ui)

### Button

```tsx
import { Button } from "@/components/ui/button";

<Button variant="default">Default</Button>
<Button variant="destructive">Destructive</Button>
<Button variant="outline">Outline</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>
```

### Card

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";

<Card>
  <CardHeader>
    <CardTitle>Título</CardTitle>
    <CardDescription>Descrição</CardDescription>
  </CardHeader>
  <CardContent>Conteúdo</CardContent>
  <CardFooter>Footer</CardFooter>
</Card>
```

### Dialog

```tsx
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

<Dialog>
  <DialogTrigger asChild>
    <Button>Abrir</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Título do Dialog</DialogTitle>
    </DialogHeader>
    {/* Conteúdo */}
  </DialogContent>
</Dialog>
```

### Form (React Hook Form + Zod)

```tsx
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const schema = z.object({
  email: z.string().email(),
});

function MyForm() {
  const form = useForm({
    resolver: zodResolver(schema),
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
```

## Componentes Customizados

### AdminShell

Container padrão para páginas administrativas.

```tsx
import { AdminShell } from "@/components/admin/AdminShell";

<AdminShell>
  <h1>Título da Página</h1>
  {/* Conteúdo */}
</AdminShell>
```

### PhoneInput

Input com máscara para telefone brasileiro.

```tsx
import { PhoneInput } from "@/components/ui/phone-input";

<PhoneInput 
  value={phone} 
  onChange={setPhone}
  placeholder="(11) 99999-9999"
/>
```

### SafeImage

Componente de imagem com fallback e lazy loading.

```tsx
import { SafeImage } from "@/components/ui/SafeImage";

<SafeImage
  src="/logo.png"
  alt="Logo"
  fallback="/placeholder.svg"
  className="w-32 h-32"
/>
```

## Design Tokens

### Cores (HSL)

```css
--background: 0 0% 100%;
--foreground: 222.2 84% 4.9%;
--primary: 222.2 47.4% 11.2%;
--secondary: 210 40% 96%;
--muted: 210 40% 96%;
--accent: 210 40% 96%;
--destructive: 0 84.2% 60.2%;
```

### Espaçamentos

Usar classes Tailwind: `p-4`, `m-2`, `gap-4`, etc.

### Tipografia

```tsx
<h1 className="text-4xl font-bold">Heading 1</h1>
<h2 className="text-3xl font-semibold">Heading 2</h2>
<h3 className="text-2xl font-semibold">Heading 3</h3>
<p className="text-base">Parágrafo</p>
<span className="text-sm text-muted-foreground">Texto secundário</span>
```

## Boas Práticas

1. **Sempre usar tokens** - Nunca usar cores diretas como `text-white`
2. **Componentes pequenos** - Dividir componentes grandes
3. **Props tipadas** - Usar TypeScript para todas as props
4. **Acessibilidade** - Incluir `aria-*` quando necessário
5. **Responsividade** - Testar em mobile, tablet e desktop

## Ícones

Usando Lucide React:

```tsx
import { Home, Settings, User } from "lucide-react";

<Home className="h-4 w-4" />
```

---

*Última atualização: 2025-12-03*
