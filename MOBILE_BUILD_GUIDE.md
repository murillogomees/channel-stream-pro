# Guia de Compilação Mobile - IPTV Link

Este guia explica como compilar o aplicativo IPTV Link para Android e iOS usando Capacitor.

## Pré-requisitos

### Para Android:
- [Android Studio](https://developer.android.com/studio) instalado
- JDK 17 ou superior
- Android SDK com API Level 33+
- Um dispositivo físico ou emulador configurado

### Para iOS:
- macOS com [Xcode](https://developer.apple.com/xcode/) instalado
- Xcode Command Line Tools
- Conta Apple Developer (para publicação)
- CocoaPods instalado (`sudo gem install cocoapods`)

## Configuração Inicial

### 1. Clonar e Configurar o Projeto

```bash
# Clonar do GitHub (se ainda não fez)
git clone <seu-repositorio>
cd <nome-do-projeto>

# Instalar dependências
npm install

# Build do projeto
npm run build
```

### 2. Adicionar Plataformas

```bash
# Adicionar Android
npx cap add android

# Adicionar iOS (apenas no macOS)
npx cap add ios
```

### 3. Sincronizar o Projeto

```bash
# Sincronizar após qualquer alteração no código
npx cap sync
```

## Compilação para Android

### Desenvolvimento/Teste

```bash
# Sincronizar projeto
npx cap sync android

# Abrir no Android Studio
npx cap open android
```

No Android Studio:
1. Aguarde o Gradle sincronizar
2. Selecione um dispositivo/emulador
3. Clique em **Run** (▶️)

### Build de Produção (APK/AAB)

1. **Remover URL de desenvolvimento** no `capacitor.config.ts`:
   ```typescript
   server: {
     // COMENTAR OU REMOVER para produção:
     // url: "https://...",
     // cleartext: true,
   },
   ```

2. **Gerar build de produção**:
   ```bash
   npm run build
   npx cap sync android
   npx cap open android
   ```

3. No Android Studio:
   - Menu: **Build → Generate Signed Bundle / APK**
   - Selecione **Android App Bundle (AAB)** para Google Play
   - Ou **APK** para distribuição direta

4. **Criar Keystore** (primeira vez):
   ```bash
   keytool -genkey -v -keystore iptvlink-release.keystore \
     -alias iptvlink -keyalg RSA -keysize 2048 -validity 10000
   ```

### Configurações Recomendadas para Google Play

Em `android/app/build.gradle`:
```gradle
android {
    defaultConfig {
        applicationId "com.iptvlink.app"
        minSdkVersion 22
        targetSdkVersion 34
        versionCode 1
        versionName "1.0.0"
    }
}
```

## Compilação para iOS

### Desenvolvimento/Teste

```bash
# Sincronizar projeto
npx cap sync ios

# Abrir no Xcode
npx cap open ios
```

No Xcode:
1. Selecione o projeto no navegador
2. Configure **Team** em Signing & Capabilities
3. Selecione um dispositivo/simulador
4. Clique em **Run** (▶️)

### Build de Produção (IPA)

1. **Remover URL de desenvolvimento** (mesmo que Android)

2. **Configurar no Xcode**:
   - Scheme: **Release**
   - Team: Sua conta Apple Developer
   - Bundle Identifier: `com.iptvlink.app`

3. **Archive e Upload**:
   - Menu: **Product → Archive**
   - Após archive: **Distribute App**
   - Selecione **App Store Connect**

### Configurações Recomendadas para App Store

Em `ios/App/App/Info.plist`, adicione:
```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <false/>
</dict>
```

## Ícones e Splash Screens

### Estrutura de Ícones Necessários

```
public/
├── icons/
│   ├── icon-192.png      # 192x192 - PWA
│   ├── icon-512.png      # 512x512 - PWA/Android
│   ├── icon-maskable.png # 512x512 - PWA maskable
│   └── icon-1024.png     # 1024x1024 - iOS App Store
└── splash/
    └── splash.png        # 2732x2732 - Universal
```

### Gerar Ícones Automaticamente

Use o [capacitor-assets](https://github.com/ionic-team/capacitor-assets):

```bash
npm install -g @capacitor/assets

# Criar ícone base (1024x1024) em resources/icon.png
# Criar splash base (2732x2732) em resources/splash.png

npx capacitor-assets generate
```

## Scripts NPM Úteis

Adicione ao `package.json`:

```json
{
  "scripts": {
    "build:mobile": "npm run build && npx cap sync",
    "android": "npx cap open android",
    "ios": "npx cap open ios",
    "android:run": "npx cap run android",
    "ios:run": "npx cap run ios"
  }
}
```

## Troubleshooting

### Android: "SDK location not found"
Crie `android/local.properties`:
```properties
sdk.dir=/Users/SEU_USUARIO/Library/Android/sdk
```

### iOS: "No signing certificate"
1. Xcode → Preferences → Accounts
2. Adicione sua Apple ID
3. Baixe os certificados

### Erro de build após atualização
```bash
npx cap sync --force
```

### Hot Reload não funciona
Verifique se a URL no `capacitor.config.ts` está correta e o dispositivo está na mesma rede.

## Publicação nas Lojas

### Google Play Store
1. Acesse [Google Play Console](https://play.google.com/console)
2. Crie um novo app
3. Preencha as informações obrigatórias
4. Upload do AAB em **Release → Production**
5. Submeta para revisão

### Apple App Store
1. Acesse [App Store Connect](https://appstoreconnect.apple.com)
2. Crie um novo app
3. Preencha as informações obrigatórias
4. Upload via Xcode ou Transporter
5. Submeta para revisão

## Checklist de Produção

- [ ] Remover URL de desenvolvimento do `capacitor.config.ts`
- [ ] Configurar `webContentsDebuggingEnabled: false` para Android
- [ ] Gerar ícones em todas as resoluções
- [ ] Configurar splash screens
- [ ] Testar em dispositivos reais
- [ ] Criar keystore de produção (Android)
- [ ] Configurar certificados de produção (iOS)
- [ ] Preparar screenshots para as lojas
- [ ] Escrever descrição e metadados
- [ ] Configurar política de privacidade

## Suporte

Para dúvidas ou problemas, consulte:
- [Documentação Capacitor](https://capacitorjs.com/docs)
- [Documentação Android](https://developer.android.com/docs)
- [Documentação iOS](https://developer.apple.com/documentation)
