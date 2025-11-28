# Guia de Build - IPTV Link Mobile App

Este guia explica como compilar o app IPTV Link para Android, iOS e Smart TVs.

## Estrutura do App

O app standalone possui apenas 3 páginas:
- `/app` - Tela de splash e redirecionamento
- `/app/login` - Login do cliente
- `/app/player` - Player IPTV
- `/app/profile` - Perfil e configurações

## Pré-requisitos

### Para Android
- Node.js 18+
- Android Studio (Arctic Fox ou superior)
- JDK 17
- Android SDK (API 33+)

### Para iOS
- macOS com Xcode 14+
- CocoaPods
- Apple Developer Account

## Setup Inicial

```bash
# 1. Clone o projeto
git clone <seu-repo>
cd <seu-projeto>

# 2. Instale as dependências
npm install

# 3. Adicione as plataformas nativas
npx cap add android
npx cap add ios
```

## Build para Desenvolvimento

### Android

```bash
# Build do projeto web
npm run build

# Sincronizar com Android
npx cap sync android

# Abrir no Android Studio
npx cap open android

# OU executar diretamente em dispositivo/emulador
npx cap run android
```

### iOS

```bash
# Build do projeto web
npm run build

# Sincronizar com iOS
npx cap sync ios

# Abrir no Xcode
npx cap open ios

# OU executar diretamente em dispositivo/simulador
npx cap run ios
```

## Build para Produção

### Android (Google Play Store)

1. **Prepare o projeto**
```bash
npm run build
npx cap sync android
npx cap open android
```

2. **No Android Studio:**
   - Build → Generate Signed Bundle / APK
   - Selecione "Android App Bundle"
   - Crie ou selecione sua keystore
   - Build Variant: release
   - Finalize o build

3. **Upload no Google Play Console:**
   - Acesse https://play.google.com/console
   - Crie um novo app ou selecione existente
   - Production → Create new release
   - Upload do arquivo .aab

### iOS (App Store)

1. **Prepare o projeto**
```bash
npm run build
npx cap sync ios
npx cap open ios
```

2. **No Xcode:**
   - Product → Archive
   - Aguarde a compilação
   - Na janela Organizer, selecione o archive
   - Distribute App → App Store Connect

3. **No App Store Connect:**
   - Acesse https://appstoreconnect.apple.com
   - Selecione seu app
   - Configure TestFlight ou submeta para revisão

## Configuração para Produção

Antes de publicar, atualize `capacitor.config.ts`:

```typescript
const config: CapacitorConfig = {
  appId: "com.iptvlink.player",
  appName: "IPTV Link",
  webDir: "dist",
  // REMOVA ou comente a seção server para produção:
  // server: {
  //   url: "https://...",
  //   cleartext: true,
  // },
  plugins: {
    // ... suas configurações
  },
  android: {
    webContentsDebuggingEnabled: false, // false em produção
  },
};
```

## Assets Necessários

### Ícones Android (res/mipmap-*)
- `ic_launcher.png` - Ícone do app
- `ic_launcher_round.png` - Ícone redondo
- `ic_launcher_foreground.png` - Foreground (adaptive icon)
- `ic_launcher_background.png` - Background (adaptive icon)

Tamanhos:
- mdpi: 48x48
- hdpi: 72x72
- xhdpi: 96x96
- xxhdpi: 144x144
- xxxhdpi: 192x192

### Ícones iOS (Assets.xcassets/AppIcon)
- 1024x1024 (App Store)
- 180x180 (iPhone @3x)
- 120x120 (iPhone @2x)
- 167x167 (iPad Pro)
- 152x152 (iPad @2x)
- 76x76 (iPad @1x)

### Splash Screens
- Android: `android/app/src/main/res/drawable/splash.png`
- iOS: LaunchScreen.storyboard

## Comandos Úteis

```bash
# Ver logs do Android
npx cap run android -l --external

# Ver logs do iOS  
npx cap run ios -l --external

# Limpar e reconstruir
rm -rf node_modules dist
npm install
npm run build
npx cap sync

# Atualizar plugins Capacitor
npx cap update
```

## Troubleshooting

### Android: "Unable to resolve host"
- Verifique `android:usesCleartextTraffic="true"` no AndroidManifest.xml
- Para produção, use HTTPS

### iOS: "No provisioning profile"
- Configure seu Team no Xcode
- Verifique seu Apple Developer Account

### Build lento
- Use `--release` para builds de produção
- Habilite cache do Gradle (Android)

## Smart TVs

Para Samsung Tizen, LG webOS e Android TV, consulte a documentação específica de cada plataforma.

## Suporte

Em caso de dúvidas, entre em contato com a equipe de desenvolvimento.
