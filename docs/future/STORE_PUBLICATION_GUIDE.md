# Guia Completo de Publicação nas Lojas de Aplicativos

Este guia detalha o processo de publicação do IPTV Link na Google Play Store e Apple App Store.

---

## 📱 Google Play Store (Android)

### Pré-requisitos

- [ ] Conta Google Play Console ($25 taxa única)
- [ ] Android Studio instalado
- [ ] Keystore de assinatura (será criado no processo)
- [ ] Ícones e screenshots do app
- [ ] URL de política de privacidade

### Passo 1: Criar Conta no Google Play Console

1. Acesse [play.google.com/console](https://play.google.com/console)
2. Faça login com sua conta Google
3. Aceite os termos de desenvolvedor
4. Pague a taxa única de $25
5. Complete a verificação de identidade (pode levar até 48h)

### Passo 2: Preparar o App para Produção

#### 2.1 Atualizar capacitor.config.ts

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.a6d041f19e9649e8bc86f2d4dd4bc0b2',
  appName: 'IPTV Link',
  webDir: 'dist',
  // REMOVER ou COMENTAR a seção server para produção:
  // server: {
  //   url: "https://...",
  //   cleartext: true
  // },
  android: {
    buildOptions: {
      keystorePath: 'release-key.keystore',
      keystoreAlias: 'iptvlink',
    }
  }
};

export default config;
```

#### 2.2 Criar Keystore de Assinatura

```bash
# No terminal, execute:
keytool -genkey -v -keystore release-key.keystore -alias iptvlink -keyalg RSA -keysize 2048 -validity 10000

# Preencha as informações solicitadas:
# - Senha do keystore (GUARDE COM SEGURANÇA!)
# - Nome e sobrenome
# - Unidade organizacional
# - Organização
# - Cidade
# - Estado
# - Código do país (BR)
```

> ⚠️ **IMPORTANTE**: Guarde o arquivo `release-key.keystore` e a senha em local seguro. Se perdê-los, não poderá atualizar o app!

#### 2.3 Gerar o Bundle de Produção

```bash
# 1. Build do projeto web
npm run build

# 2. Sincronizar com Android
npx cap sync android

# 3. Abrir no Android Studio
npx cap open android
```

No Android Studio:
1. Menu **Build** → **Generate Signed Bundle / APK**
2. Selecione **Android App Bundle**
3. Selecione o keystore criado
4. Preencha as senhas
5. Escolha **release** como build variant
6. Clique em **Create**

O arquivo `.aab` será gerado em:
`android/app/release/app-release.aab`

### Passo 3: Criar Ficha do App no Play Console

1. No Play Console, clique em **Criar app**
2. Preencha as informações básicas:
   - **Nome do app**: IPTV Link
   - **Idioma padrão**: Português (Brasil)
   - **App ou jogo**: App
   - **Gratuito ou pago**: Escolha conforme seu modelo

3. **Configurar a ficha da loja**:

#### Informações do App
| Campo | Valor Sugerido |
|-------|----------------|
| Título | IPTV Link - TV Online HD |
| Descrição curta | Assista TV ao vivo em HD no seu celular |
| Descrição completa | (Veja modelo abaixo) |
| Categoria | Entretenimento |

**Modelo de Descrição Completa:**
```
📺 IPTV Link - Sua TV em qualquer lugar!

Assista seus canais favoritos em alta definição, onde você estiver. Com o IPTV Link, você tem acesso a:

✅ Canais ao vivo em HD e Full HD
✅ Filmes e séries sob demanda
✅ Interface intuitiva e fácil de usar
✅ Compatível com Smart TV, celular e tablet
✅ Baixo consumo de dados
✅ Sem travamentos

🎬 Milhares de conteúdos disponíveis
📱 Assista no celular, tablet ou TV
⚡ Streaming rápido e estável

Baixe agora e transforme seu dispositivo em uma central de entretenimento!
```

#### Assets Gráficos Necessários

| Asset | Dimensões | Formato |
|-------|-----------|---------|
| Ícone do app | 512 x 512 px | PNG (32-bit) |
| Feature graphic | 1024 x 500 px | PNG ou JPG |
| Screenshots (mín. 2) | 320-3840 px | PNG ou JPG |
| Screenshots tablet (opcional) | 1080-7680 px | PNG ou JPG |

### Passo 4: Configurações Obrigatórias

#### 4.1 Política de Privacidade
- Crie uma página com sua política de privacidade
- Hospede em uma URL pública (ex: seu site/privacidade)
- Cole a URL no campo correspondente

#### 4.2 Classificação de Conteúdo
1. Vá em **Política** → **Conteúdo do app** → **Classificação do conteúdo**
2. Responda o questionário sobre o conteúdo do app
3. A classificação será atribuída automaticamente

#### 4.3 Público-alvo e Conteúdo
- Defina a faixa etária do público-alvo
- Declare se o app contém anúncios
- Informe se há compras no app

### Passo 5: Upload e Submissão

1. Vá em **Produção** → **Criar nova versão**
2. Faça upload do arquivo `.aab`
3. Adicione notas da versão:
   ```
   Versão 1.0.0
   • Lançamento inicial
   • Streaming de canais ao vivo
   • Interface moderna e intuitiva
   • Suporte a múltiplos dispositivos
   ```
4. Selecione os países de distribuição
5. Revise todas as informações
6. Clique em **Iniciar lançamento para produção**

### Tempo de Revisão
- Primeira submissão: 2-7 dias úteis
- Atualizações: 1-3 dias úteis

---

## 🍎 Apple App Store (iOS)

### Pré-requisitos

- [ ] Mac com macOS atualizado
- [ ] Xcode instalado (versão mais recente)
- [ ] Apple Developer Account ($99/ano)
- [ ] iPhone/iPad para testes (recomendado)
- [ ] Ícones e screenshots do app
- [ ] URL de política de privacidade

### Passo 1: Criar Apple Developer Account

1. Acesse [developer.apple.com](https://developer.apple.com)
2. Clique em **Account** → **Enroll**
3. Faça login com seu Apple ID
4. Complete o cadastro como desenvolvedor
5. Pague a taxa anual de $99
6. Aguarde aprovação (geralmente 24-48h)

### Passo 2: Configurar Certificados e Provisioning Profiles

#### 2.1 No Apple Developer Portal

1. Acesse **Certificates, Identifiers & Profiles**
2. Crie um **App ID**:
   - Identifier: `app.lovable.a6d041f19e9649e8bc86f2d4dd4bc0b2`
   - Description: IPTV Link
   - Capabilities: Selecione as necessárias

3. Crie um **Distribution Certificate**:
   - Tipo: iOS Distribution (App Store)
   - Siga as instruções para gerar o CSR

4. Crie um **Provisioning Profile**:
   - Tipo: App Store
   - Selecione o App ID criado
   - Selecione o certificado
   - Baixe e instale no Xcode

### Passo 3: Preparar o App no Xcode

```bash
# 1. Build do projeto
npm run build

# 2. Sincronizar com iOS
npx cap sync ios

# 3. Abrir no Xcode
npx cap open ios
```

#### No Xcode:

1. Selecione o projeto **App** no navigator
2. Em **Signing & Capabilities**:
   - Team: Selecione sua conta
   - Bundle Identifier: `app.lovable.a6d041f19e9649e8bc86f2d4dd4bc0b2`
   - Signing Certificate: Distribution

3. Em **General**:
   - Display Name: IPTV Link
   - Version: 1.0.0
   - Build: 1

### Passo 4: Criar Archive e Enviar

1. Selecione **Any iOS Device** como target
2. Menu **Product** → **Archive**
3. Aguarde a compilação
4. Na janela Organizer:
   - Selecione o archive criado
   - Clique em **Distribute App**
   - Escolha **App Store Connect**
   - Selecione **Upload**
   - Aguarde o upload

### Passo 5: Configurar no App Store Connect

1. Acesse [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Clique em **My Apps** → **+** → **New App**
3. Preencha:
   - Platform: iOS
   - Name: IPTV Link
   - Primary Language: Portuguese (Brazil)
   - Bundle ID: Selecione o criado
   - SKU: iptvlink-001

#### Informações do App

| Campo | Valor |
|-------|-------|
| Subtítulo | TV ao vivo em HD |
| Categoria | Entretenimento |
| Categoria secundária | Estilo de vida |
| Classificação etária | (Preencha questionário) |

#### Screenshots Necessários

| Dispositivo | Dimensões |
|-------------|-----------|
| iPhone 6.7" | 1290 x 2796 ou 1284 x 2778 |
| iPhone 6.5" | 1242 x 2688 ou 1284 x 2778 |
| iPhone 5.5" | 1242 x 2208 |
| iPad Pro 12.9" | 2048 x 2732 |
| iPad Pro 11" | 1668 x 2388 |

#### Informações de Privacidade

1. Vá em **App Privacy**
2. Responda sobre coleta de dados:
   - Dados de uso
   - Identificadores
   - Dados de contato (se aplicável)
3. Informe se há tracking

### Passo 6: Submissão para Revisão

1. Na aba **App Store**:
   - Selecione o build enviado
   - Preencha **What's New**:
     ```
     Versão 1.0.0
     • Lançamento inicial
     • Streaming de canais ao vivo em HD
     • Interface intuitiva e moderna
     • Favoritos e histórico
     ```

2. Em **App Review Information**:
   - Forneça conta de teste (se necessário)
   - Notas para revisão
   - Informações de contato

3. Clique em **Submit for Review**

### Tempo de Revisão
- Primeira submissão: 1-3 dias úteis
- Atualizações: 24-48 horas
- Rejeições comuns: Resolva e resubmeta

---

## 📋 Checklist Final

### Google Play Store
- [ ] Conta Play Console verificada
- [ ] Keystore criada e guardada em segurança
- [ ] Bundle (.aab) gerado em release
- [ ] Ícone 512x512 px
- [ ] Feature graphic 1024x500 px
- [ ] Mínimo 2 screenshots
- [ ] Descrição completa preenchida
- [ ] Política de privacidade publicada
- [ ] Classificação de conteúdo respondida
- [ ] Países de distribuição selecionados

### Apple App Store
- [ ] Apple Developer Account ativa
- [ ] Certificados e profiles configurados
- [ ] Archive criado e enviado
- [ ] App Icon 1024x1024 px
- [ ] Screenshots para todos os tamanhos
- [ ] Informações de privacidade preenchidas
- [ ] Informações de revisão completas
- [ ] Conta de teste (se necessário)

---

## 🔄 Atualizando o App

### Android
```bash
# 1. Atualize a versão em capacitor.config.ts
# 2. Build e sync
npm run build
npx cap sync android

# 3. Gere novo bundle assinado
# 4. Upload no Play Console com notas da versão
```

### iOS
```bash
# 1. Atualize Version e Build no Xcode
# 2. Build e sync
npm run build
npx cap sync ios

# 3. Crie novo Archive
# 4. Upload para App Store Connect
# 5. Submeta nova versão para revisão
```

---

## ❓ Problemas Comuns

### Google Play
| Problema | Solução |
|----------|---------|
| Bundle rejeitado por segurança | Verifique permissões declaradas |
| Política violada | Revise conteúdo e descrição |
| Screenshots insuficientes | Adicione mínimo 2 por tipo de tela |

### Apple App Store
| Problema | Solução |
|----------|---------|
| Provisioning profile inválido | Regenere no Developer Portal |
| App rejeitado por guideline | Leia feedback e ajuste |
| Build não aparece | Aguarde ~30 min após upload |

---

## 📚 Recursos Úteis

- [Documentação Play Console](https://support.google.com/googleplay/android-developer)
- [Documentação App Store Connect](https://developer.apple.com/app-store-connect/)
- [Guidelines de Design Android](https://developer.android.com/design)
- [Human Interface Guidelines iOS](https://developer.apple.com/design/human-interface-guidelines/)
