# Guia de Teste Mobile - Android e iOS

Este guia explica como testar o IPTV Link em dispositivos Android e iOS durante o desenvolvimento.

---

## 🚀 Modos de Teste

### Modo 1: Hot Reload (Desenvolvimento Rápido)

- O app carrega do servidor Lovable
- Mudanças no código aparecem instantaneamente
- **Requer conexão com internet**
- Ideal para desenvolvimento ativo

### Modo 2: Build Local (Standalone)

- O app é compilado com todo o código embarcado
- Funciona offline
- Mais lento para iterar
- Ideal para testes finais

---

## 📱 Android - Teste em Dispositivo Real

### Pré-requisitos

- [ ] Android Studio instalado
- [ ] Cabo USB de dados (não apenas de carga)
- [ ] Celular Android (Android 7.0+)
- [ ] Node.js instalado

### Passo 1: Habilitar Modo Desenvolvedor no Celular

1. Vá em **Configurações** → **Sobre o telefone**
2. Toque 7 vezes em **Número da versão**
3. Uma mensagem aparecerá: "Você agora é um desenvolvedor!"

### Passo 2: Habilitar Depuração USB

1. Vá em **Configurações** → **Opções do desenvolvedor**
2. Ative **Opções do desenvolvedor** (toggle no topo)
3. Ative **Depuração USB**
4. (Opcional) Ative **Instalar via USB**

### Passo 3: Conectar e Autorizar

1. Conecte o celular ao computador via USB
2. No celular, aparecerá um popup: "Permitir depuração USB?"
3. Marque "Sempre permitir deste computador"
4. Toque em **OK**

### Passo 4: Verificar Conexão

```bash
# Verifique se o dispositivo está conectado
adb devices

# Saída esperada:
# List of devices attached
# XXXXXXXX    device
```

Se aparecer `unauthorized`, desconecte e reconecte o celular, aceitando o popup novamente.

### Passo 5: Executar o App

#### Hot Reload (Recomendado para Dev)

```bash
# O capacitor.config.ts já está configurado para hot reload
npx cap run android
```

#### Build Local

```bash
# 1. Build do projeto
npm run build

# 2. Sincronizar
npx cap sync android

# 3. Executar
npx cap run android
```

### Passo 6: Selecionar Dispositivo

Quando executar `npx cap run android`:

1. Uma lista de dispositivos aparecerá
2. Selecione seu dispositivo físico
3. Aguarde a instalação e execução

---

## 🍎 iOS - Teste em Dispositivo Real

### Pré-requisitos

- [ ] Mac com macOS
- [ ] Xcode instalado (App Store)
- [ ] iPhone ou iPad
- [ ] Cabo Lightning/USB-C
- [ ] Apple ID (grátis para testes)

### Passo 1: Configurar Xcode

1. Abra Xcode
2. Vá em **Xcode** → **Preferences** → **Accounts**
3. Clique em **+** e adicione seu Apple ID
4. Selecione sua conta e clique em **Manage Certificates**
5. Clique em **+** → **Apple Development** para criar um certificado

### Passo 2: Conectar iPhone/iPad

1. Conecte o dispositivo via cabo
2. No dispositivo, toque em **Confiar** quando solicitado
3. Digite a senha do dispositivo se pedida

### Passo 3: Abrir Projeto no Xcode

```bash
# Sincronizar projeto
npx cap sync ios

# Abrir no Xcode
npx cap open ios
```

### Passo 4: Configurar Assinatura

1. No Xcode, selecione o projeto **App** no navigator esquerdo
2. Selecione o target **App**
3. Em **Signing & Capabilities**:
   - Marque **Automatically manage signing**
   - Selecione seu **Team** (sua conta Apple ID)
   - O Xcode criará um provisioning profile automaticamente

### Passo 5: Selecionar Dispositivo e Executar

1. No topo do Xcode, clique no seletor de dispositivo
2. Selecione seu iPhone/iPad conectado
3. Clique no botão **▶️ (Run)** ou pressione `Cmd + R`

### Passo 6: Confiar no Desenvolvedor (Primeira Vez)

Na primeira execução, o iOS bloqueia apps de desenvolvedores não confiáveis:

1. No iPhone, vá em **Ajustes** → **Geral** → **Gerenciamento de Dispositivos**
2. Toque no seu Apple ID de desenvolvedor
3. Toque em **Confiar**
4. Volte ao Xcode e execute novamente

---

## 🔧 Comandos Úteis

### Android

```bash
# Executar com logs em tempo real
npx cap run android -l

# Executar com logs e IP externo (para debug remoto)
npx cap run android -l --external

# Listar dispositivos conectados
adb devices

# Ver logs do app em tempo real
adb logcat | grep -i "iptvlink\|capacitor"

# Instalar APK manualmente
adb install -r android/app/build/outputs/apk/debug/app-debug.apk

# Desinstalar app
adb uninstall app.lovable.a6d041f19e9649e8bc86f2d4dd4bc0b2

# Reiniciar servidor ADB (se problemas de conexão)
adb kill-server
adb start-server

# Capturar screenshot
adb exec-out screencap -p > screenshot.png

# Gravar tela
adb shell screenrecord /sdcard/video.mp4
# Ctrl+C para parar
adb pull /sdcard/video.mp4
```

### iOS

```bash
# Executar com logs
npx cap run ios -l

# Executar com IP externo
npx cap run ios -l --external

# Listar dispositivos conectados
xcrun xctrace list devices

# Listar simuladores disponíveis
xcrun simctl list devices

# Abrir em simulador específico
npx cap run ios --target="iPhone 15"

# Limpar build cache
cd ios && xcodebuild clean && cd ..
```

### Debug Remoto

#### Android (Chrome DevTools)

1. Execute o app no dispositivo
2. No computador, abra Chrome
3. Digite na barra de endereço: `chrome://inspect`
4. Seu app aparecerá na lista
5. Clique em **inspect** para abrir DevTools

#### iOS (Safari Web Inspector)

1. No iPhone: **Ajustes** → **Safari** → **Avançado** → **Web Inspector** (ativar)
2. No Mac: **Safari** → **Preferências** → **Avançado** → **Mostrar menu Desenvolvedor**
3. Execute o app
4. No Safari do Mac: **Desenvolvedor** → [Seu iPhone] → [Seu App]

---

## 📱 Testando em Emuladores

### Android Emulator

```bash
# Listar emuladores disponíveis
emulator -list-avds

# Criar emulador via Android Studio:
# Tools → Device Manager → Create Device

# Executar no emulador
npx cap run android --target="Pixel_7_API_34"
```

### iOS Simulator

```bash
# Listar simuladores
xcrun simctl list devices

# Executar em simulador específico
npx cap run ios --target="iPhone 15 Pro"

# Abrir Simulator diretamente
open -a Simulator
```

---

## 🔄 Workflow de Desenvolvimento

### Fluxo Recomendado

```
┌─────────────────────────────────────────────────────────┐
│                    DESENVOLVIMENTO                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. Edite código no Lovable                             │
│              ↓                                           │
│  2. Visualize no preview web                            │
│              ↓                                           │
│  3. Teste no celular (hot reload)                       │
│     npx cap run android                                  │
│              ↓                                           │
│  4. Itere até ficar satisfeito                          │
│              ↓                                           │
│  5. Build final para produção                           │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Sincronização Rápida

Quando fizer git pull de novas mudanças:

```bash
# Apenas sincronizar (se não mudou dependências)
npx cap sync

# Se mudou package.json
npm install
npx cap sync

# Rebuild completo
npm run build
npx cap sync
npx cap run android  # ou ios
```

---

## ❓ Solução de Problemas

### Android

| Problema                             | Solução                                            |
| ------------------------------------ | -------------------------------------------------- |
| `device unauthorized`                | Desconecte/reconecte USB e aceite popup no celular |
| `no devices found`                   | Verifique cabo e modo desenvolvedor                |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | Desinstale app antigo: `adb uninstall [package]`   |
| App não carrega conteúdo             | Verifique conexão de internet do celular           |
| Build lento                          | Use `--no-build` se só mudou web                   |

### iOS

| Problema                              | Solução                                   |
| ------------------------------------- | ----------------------------------------- |
| `No provisioning profile`             | Configure Team no Xcode                   |
| `Device is busy`                      | Aguarde ou reinicie dispositivo           |
| `Unable to install app`               | Confie no desenvolvedor nas configurações |
| `Signing requires a development team` | Adicione Apple ID no Xcode                |
| Build falha                           | `cd ios && pod install && cd ..`          |

### Geral

| Problema              | Solução                                       |
| --------------------- | --------------------------------------------- |
| Mudanças não aparecem | Verifique se salvou arquivos, `npx cap sync`  |
| App crashando         | Verifique logs com `-l` flag                  |
| Sem hot reload        | Confirme URL correta em `capacitor.config.ts` |
| Tela branca           | Erro JavaScript, verifique console            |

---

## 📋 Checklist de Teste

### Antes de Publicar

- [ ] Testado em dispositivo Android real
- [ ] Testado em dispositivo iOS real (se possível)
- [ ] Login funcionando
- [ ] Streaming de canais funcionando
- [ ] Navegação entre telas ok
- [ ] Performance aceitável
- [ ] Sem crashes
- [ ] Funciona em diferentes tamanhos de tela
- [ ] Orientação portrait/landscape (se suportado)
- [ ] Comportamento offline (mensagem apropriada)

---

## 📚 Recursos

- [Documentação Capacitor](https://capacitorjs.com/docs)
- [Android Debug Bridge](https://developer.android.com/studio/command-line/adb)
- [Xcode Help](https://developer.apple.com/documentation/xcode)
- [Chrome Remote Debugging](https://developer.chrome.com/docs/devtools/remote-debugging/)
