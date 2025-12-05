/**
 * AndroidDeployInstructions - Instruções detalhadas de deploy Android
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Terminal, 
  ExternalLink, 
  Copy, 
  CheckCircle2, 
  Circle,
  Smartphone,
  Key,
  Upload,
  TestTube,
  Package,
  Shield,
  FileCode,
  AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ChecklistItem {
  id: string;
  label: string;
  description?: string;
  required: boolean;
}

const PREREQUISITES: ChecklistItem[] = [
  { id: 'node', label: 'Node.js 18+ instalado', required: true },
  { id: 'java', label: 'JDK 17 instalado', description: 'OpenJDK ou Oracle JDK', required: true },
  { id: 'android-studio', label: 'Android Studio instalado', description: 'Com Android SDK', required: true },
  { id: 'gradle', label: 'Gradle configurado', required: true },
  { id: 'google-account', label: 'Conta Google Play Console', description: 'Com app registrado', required: true },
  { id: 'keystore', label: 'Keystore para assinatura', description: 'release.keystore gerado', required: true },
  { id: 'env-vars', label: 'Variáveis de ambiente', description: 'ANDROID_HOME, JAVA_HOME', required: true },
];

const DEPLOY_COMMANDS = [
  {
    step: 1,
    title: 'Instalar dependências',
    command: 'npm install',
    description: 'Instala todas as dependências do projeto'
  },
  {
    step: 2,
    title: 'Build do projeto web',
    command: 'npm run build',
    description: 'Compila o projeto React/Vite'
  },
  {
    step: 3,
    title: 'Sincronizar com Capacitor',
    command: 'npx cap sync android',
    description: 'Sincroniza o build web com o projeto Android'
  },
  {
    step: 4,
    title: 'Abrir no Android Studio',
    command: 'npx cap open android',
    description: 'Abre o projeto no Android Studio para build'
  },
  {
    step: 5,
    title: 'Build APK de release',
    command: 'cd android && ./gradlew assembleRelease',
    description: 'Gera o APK assinado para produção'
  },
  {
    step: 6,
    title: 'Build AAB para Play Store',
    command: 'cd android && ./gradlew bundleRelease',
    description: 'Gera o Android App Bundle (recomendado)'
  }
];

const USEFUL_LINKS = [
  {
    title: 'Google Play Console',
    url: 'https://play.google.com/console',
    description: 'Painel de publicação de apps'
  },
  {
    title: 'Firebase Console',
    url: 'https://console.firebase.google.com',
    description: 'Analytics e crashlytics'
  },
  {
    title: 'Capacitor Docs - Android',
    url: 'https://capacitorjs.com/docs/android',
    description: 'Documentação oficial Capacitor'
  },
  {
    title: 'Android Developer Guide',
    url: 'https://developer.android.com/studio/publish',
    description: 'Guia de publicação Google'
  }
];

export function AndroidDeployInstructions() {
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  const copyCommand = (command: string) => {
    navigator.clipboard.writeText(command);
    toast.success('Comando copiado!');
  };

  const toggleChecklist = (id: string) => {
    setChecklist(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const completedCount = Object.values(checklist).filter(Boolean).length;
  const progress = (completedCount / PREREQUISITES.length) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl bg-green-500/10">
          <Smartphone className="h-6 w-6 text-green-500" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Deploy Android</h2>
          <p className="text-sm text-muted-foreground">
            Guia completo para build e publicação na Google Play Store
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Checklist de Pré-requisitos */}
        <Card className="lg:col-span-1 border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Pré-requisitos
            </CardTitle>
            <CardDescription>
              {completedCount}/{PREREQUISITES.length} completos
            </CardDescription>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-3">
                {PREREQUISITES.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
                      checklist[item.id] 
                        ? "bg-green-500/5 border-green-500/30" 
                        : "hover:bg-muted/50"
                    )}
                    onClick={() => toggleChecklist(item.id)}
                  >
                    <Checkbox
                      checked={checklist[item.id] || false}
                      onCheckedChange={() => toggleChecklist(item.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-sm font-medium",
                          checklist[item.id] && "line-through text-muted-foreground"
                        )}>
                          {item.label}
                        </span>
                        {item.required && (
                          <Badge variant="outline" className="text-[10px]">Obrigatório</Badge>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Comandos de Deploy */}
        <Card className="lg:col-span-2 border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Terminal className="h-4 w-4" />
              Comandos Capacitor
            </CardTitle>
            <CardDescription>
              Execute em sequência no terminal do projeto
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-3">
                {DEPLOY_COMMANDS.map((cmd) => (
                  <div
                    key={cmd.step}
                    className="group p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          Passo {cmd.step}
                        </Badge>
                        <span className="text-sm font-medium">{cmd.title}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => copyCommand(cmd.command)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <code className="block p-2 rounded bg-background font-mono text-xs text-primary">
                      {cmd.command}
                    </code>
                    <p className="text-xs text-muted-foreground mt-2">
                      {cmd.description}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Detalhes Expandíveis */}
      <Card className="border-border/50">
        <CardContent className="pt-6">
          <Accordion type="single" collapsible className="w-full">
            {/* Keystore */}
            <AccordionItem value="keystore">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-amber-500" />
                  <span>Gerar Keystore de Assinatura</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm mb-3">
                    O keystore é usado para assinar o APK/AAB. <strong>Guarde com segurança!</strong>
                  </p>
                  <div className="space-y-2">
                    <code className="block p-3 rounded bg-background font-mono text-xs overflow-x-auto">
                      keytool -genkey -v -keystore release.keystore -alias iptvlink -keyalg RSA -keysize 2048 -validity 10000
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyCommand('keytool -genkey -v -keystore release.keystore -alias iptvlink -keyalg RSA -keysize 2048 -validity 10000')}
                    >
                      <Copy className="h-3 w-3 mr-2" />
                      Copiar comando
                    </Button>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                  <div className="text-sm">
                    <strong>Importante:</strong> Nunca perca o keystore ou a senha. 
                    Você não poderá atualizar o app na Play Store sem ele.
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Gradle Config */}
            <AccordionItem value="gradle">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <FileCode className="h-4 w-4 text-blue-500" />
                  <span>Configurar build.gradle</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm mb-3">
                    Adicione em <code>android/app/build.gradle</code>:
                  </p>
                  <pre className="p-3 rounded bg-background font-mono text-xs overflow-x-auto">
{`android {
    signingConfigs {
        release {
            storeFile file('release.keystore')
            storePassword System.getenv("KEYSTORE_PASSWORD")
            keyAlias 'iptvlink'
            keyPassword System.getenv("KEY_PASSWORD")
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt')
        }
    }
}`}
                  </pre>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Testing */}
            <AccordionItem value="testing">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <TestTube className="h-4 w-4 text-purple-500" />
                  <span>Testar no Emulador/Dispositivo</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <h4 className="font-medium mb-2">Emulador</h4>
                    <code className="block p-2 rounded bg-background font-mono text-xs">
                      npx cap run android
                    </code>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <h4 className="font-medium mb-2">Dispositivo USB</h4>
                    <code className="block p-2 rounded bg-background font-mono text-xs">
                      npx cap run android --target=device
                    </code>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Upload */}
            <AccordionItem value="upload">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Upload className="h-4 w-4 text-green-500" />
                  <span>Publicar na Google Play Store</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-lg border">
                    <Badge className="mt-0.5">1</Badge>
                    <div>
                      <p className="font-medium">Acesse o Google Play Console</p>
                      <p className="text-sm text-muted-foreground">
                        Vá para Produção → Versões → Criar nova versão
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg border">
                    <Badge className="mt-0.5">2</Badge>
                    <div>
                      <p className="font-medium">Faça upload do AAB</p>
                      <p className="text-sm text-muted-foreground">
                        Arquivo em: <code>android/app/build/outputs/bundle/release/</code>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg border">
                    <Badge className="mt-0.5">3</Badge>
                    <div>
                      <p className="font-medium">Preencha as notas de versão</p>
                      <p className="text-sm text-muted-foreground">
                        Descreva as mudanças desta versão
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg border">
                    <Badge className="mt-0.5">4</Badge>
                    <div>
                      <p className="font-medium">Envie para revisão</p>
                      <p className="text-sm text-muted-foreground">
                        A Google revisará em 1-7 dias úteis
                      </p>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Links Úteis */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ExternalLink className="h-4 w-4" />
            Links Úteis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {USEFUL_LINKS.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col p-4 rounded-lg border hover:border-primary/50 hover:bg-muted/50 transition-colors group"
              >
                <span className="font-medium text-sm group-hover:text-primary transition-colors">
                  {link.title}
                </span>
                <span className="text-xs text-muted-foreground mt-1">
                  {link.description}
                </span>
                <ExternalLink className="h-3 w-3 mt-2 opacity-50 group-hover:opacity-100" />
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
