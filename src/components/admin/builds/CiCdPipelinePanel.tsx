/**
 * CiCdPipelinePanel - Configuração do Pipeline CI/CD
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  GitBranch, 
  Play, 
  AlertTriangle,
  CheckCircle2,
  Bell,
  RotateCcw,
  ArrowDown,
  GripVertical,
  Smartphone,
  Tablet,
  Monitor,
  Tv,
  Globe,
  Gamepad2
} from "lucide-react";
import { useBuildSystem } from "./hooks/useBuildSystem";
import { PlatformName, PLATFORM_LABELS } from "./types";

const PLATFORM_ICON_MAP: Record<PlatformName, React.ElementType> = {
  android: Smartphone,
  ios: Tablet,
  web: Globe,
  tizen: Tv,
  webos: Tv,
  roku: Tv,
  desktop: Monitor,
  console: Gamepad2
};

export function CiCdPipelinePanel() {
  const { 
    ciCdConfig, 
    automationConfig, 
    updateCiCdConfig, 
    updateAutomationConfig,
    startAllBuilds,
    isRunning
  } = useBuildSystem();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* CI/CD Settings */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Configurações CI/CD
          </CardTitle>
          <CardDescription>
            Configure o comportamento do pipeline de integração contínua
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <Play className="h-4 w-4 text-green-500" />
                <div>
                  <Label>Auto Test</Label>
                  <p className="text-xs text-muted-foreground">Executar testes automaticamente</p>
                </div>
              </div>
              <Switch 
                checked={ciCdConfig.autoTest}
                onCheckedChange={(checked) => updateCiCdConfig({ autoTest: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <Monitor className="h-4 w-4 text-blue-500" />
                <div>
                  <Label>Emulator Simulation</Label>
                  <p className="text-xs text-muted-foreground">Testar em emuladores/simuladores</p>
                </div>
              </div>
              <Switch 
                checked={ciCdConfig.emulatorSimulation}
                onCheckedChange={(checked) => updateCiCdConfig({ emulatorSimulation: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <div>
                  <Label>Failure Alert</Label>
                  <p className="text-xs text-muted-foreground">Alertar em caso de falha</p>
                </div>
              </div>
              <Switch 
                checked={ciCdConfig.failureAlert}
                onCheckedChange={(checked) => updateCiCdConfig({ failureAlert: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <div>
                  <Label>Success Notification</Label>
                  <p className="text-xs text-muted-foreground">Notificar quando sucesso</p>
                </div>
              </div>
              <Switch 
                checked={ciCdConfig.successNotification}
                onCheckedChange={(checked) => updateCiCdConfig({ successNotification: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <ArrowDown className="h-4 w-4 text-purple-500" />
                <div>
                  <Label>Sequential Build</Label>
                  <p className="text-xs text-muted-foreground">Builds em sequência (vs paralelo)</p>
                </div>
              </div>
              <Switch 
                checked={ciCdConfig.sequentialBuild}
                onCheckedChange={(checked) => updateCiCdConfig({ sequentialBuild: checked })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Automation Settings */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Automação
          </CardTitle>
          <CardDescription>
            Configure comportamentos automáticos do sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <Play className="h-4 w-4 text-green-500" />
                <div>
                  <Label>Trigger All Builds</Label>
                  <p className="text-xs text-muted-foreground">Permitir build de todas plataformas</p>
                </div>
              </div>
              <Switch 
                checked={automationConfig.triggerAllBuilds}
                onCheckedChange={(checked) => updateAutomationConfig({ triggerAllBuilds: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <Bell className="h-4 w-4 text-blue-500" />
                <div>
                  <Label>Notify on Complete</Label>
                  <p className="text-xs text-muted-foreground">Notificar ao completar pipeline</p>
                </div>
              </div>
              <Switch 
                checked={automationConfig.notifyOnComplete}
                onCheckedChange={(checked) => updateAutomationConfig({ notifyOnComplete: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <RotateCcw className="h-4 w-4 text-orange-500" />
                <div>
                  <Label>Retry on Fail</Label>
                  <p className="text-xs text-muted-foreground">Continuar pipeline mesmo com falhas</p>
                </div>
              </div>
              <Switch 
                checked={automationConfig.retryOnFail}
                onCheckedChange={(checked) => updateAutomationConfig({ retryOnFail: checked })}
              />
            </div>
          </div>

          <Button 
            className="w-full mt-4" 
            onClick={startAllBuilds}
            disabled={isRunning || !automationConfig.triggerAllBuilds}
          >
            <Play className="h-4 w-4 mr-2" />
            Executar Pipeline Completo
          </Button>
        </CardContent>
      </Card>

      {/* Build Order */}
      <Card className="lg:col-span-2 border-border/50">
        <CardHeader>
          <CardTitle>Ordem de Build</CardTitle>
          <CardDescription>
            Sequência de execução dos builds (arraste para reordenar)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {ciCdConfig.buildOrder.map((platform, index) => {
              const Icon = PLATFORM_ICON_MAP[platform];
              return (
                <div 
                  key={platform}
                  className="flex items-center gap-2 p-2 px-3 rounded-lg border bg-card hover:bg-accent/50 cursor-move transition-colors"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="outline" className="text-xs">
                    {index + 1}
                  </Badge>
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{PLATFORM_LABELS[platform]}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
