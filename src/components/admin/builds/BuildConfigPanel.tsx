/**
 * BuildConfigPanel - Configurações de build por plataforma
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Save, 
  RotateCcw,
  Smartphone,
  Tablet,
  Monitor,
  Tv,
  Globe,
  Gamepad2,
  Settings2
} from "lucide-react";
import { useBuildSystem } from "./hooks/useBuildSystem";
import { Platform, PlatformName, PLATFORM_LABELS } from "./types";
import { toast } from "sonner";

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

export function BuildConfigPanel() {
  const { platforms, updatePlatformConfig } = useBuildSystem();
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformName>('android');
  const [editedConfig, setEditedConfig] = useState<Platform | null>(null);

  const currentPlatform = platforms.find(p => p.name === selectedPlatform);

  const handleSelectPlatform = (name: PlatformName) => {
    setSelectedPlatform(name);
    setEditedConfig(null);
  };

  const handleEdit = () => {
    if (currentPlatform) {
      setEditedConfig({ ...currentPlatform });
    }
  };

  const handleSave = () => {
    if (editedConfig) {
      updatePlatformConfig(selectedPlatform, editedConfig);
      setEditedConfig(null);
    }
  };

  const handleReset = () => {
    setEditedConfig(null);
    toast.info('Alterações descartadas');
  };

  const config = editedConfig || currentPlatform;
  if (!config) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Platform Selector */}
      <Card className="lg:col-span-1 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Plataformas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {platforms.map((platform) => {
            const Icon = PLATFORM_ICON_MAP[platform.name];
            return (
              <Button
                key={platform.name}
                variant={selectedPlatform === platform.name ? "secondary" : "ghost"}
                className="w-full justify-start gap-2"
                onClick={() => handleSelectPlatform(platform.name)}
              >
                <Icon className="h-4 w-4" />
                {PLATFORM_LABELS[platform.name]}
              </Button>
            );
          })}
        </CardContent>
      </Card>

      {/* Configuration Panel */}
      <Card className="lg:col-span-3 border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                Configuração: {PLATFORM_LABELS[selectedPlatform]}
              </CardTitle>
              <CardDescription>
                Ajuste as configurações de build e player para esta plataforma
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {editedConfig ? (
                <>
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleSave}>
                    <Save className="h-4 w-4 mr-1" />
                    Salvar
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={handleEdit}>
                  Editar
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="player" className="space-y-4">
            <TabsList>
              <TabsTrigger value="player">Player Config</TabsTrigger>
              <TabsTrigger value="paths">Paths</TabsTrigger>
              <TabsTrigger value="scripts">Scripts</TabsTrigger>
            </TabsList>

            <TabsContent value="player" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Web Workers */}
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <Label>Web Workers</Label>
                    <p className="text-xs text-muted-foreground">Processamento em thread separada</p>
                  </div>
                  <Switch 
                    checked={config.playerConfig.webWorkers}
                    disabled={!editedConfig}
                    onCheckedChange={(checked) => 
                      setEditedConfig(prev => prev ? {
                        ...prev,
                        playerConfig: { ...prev.playerConfig, webWorkers: checked }
                      } : null)
                    }
                  />
                </div>

                {/* Low Latency */}
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <Label>Low Latency</Label>
                    <p className="text-xs text-muted-foreground">Modo de baixa latência</p>
                  </div>
                  <Switch 
                    checked={config.playerConfig.lowLatency}
                    disabled={!editedConfig}
                    onCheckedChange={(checked) => 
                      setEditedConfig(prev => prev ? {
                        ...prev,
                        playerConfig: { ...prev.playerConfig, lowLatency: checked }
                      } : null)
                    }
                  />
                </div>

                {/* Buffer Size */}
                <div className="space-y-2 p-3 rounded-lg border">
                  <div className="flex justify-between">
                    <Label>Buffer Size</Label>
                    <Badge variant="outline">{config.playerConfig.buffer}s</Badge>
                  </div>
                  <Slider
                    value={[config.playerConfig.buffer]}
                    min={5}
                    max={60}
                    step={5}
                    disabled={!editedConfig}
                    onValueChange={([value]) => 
                      setEditedConfig(prev => prev ? {
                        ...prev,
                        playerConfig: { ...prev.playerConfig, buffer: value }
                      } : null)
                    }
                  />
                </div>

                {/* Retries */}
                <div className="space-y-2 p-3 rounded-lg border">
                  <div className="flex justify-between">
                    <Label>Retries</Label>
                    <Badge variant="outline">{config.playerConfig.retries}</Badge>
                  </div>
                  <Slider
                    value={[config.playerConfig.retries]}
                    min={1}
                    max={10}
                    step={1}
                    disabled={!editedConfig}
                    onValueChange={([value]) => 
                      setEditedConfig(prev => prev ? {
                        ...prev,
                        playerConfig: { ...prev.playerConfig, retries: value }
                      } : null)
                    }
                  />
                </div>

                {/* Fragment Size */}
                <div className="space-y-2 p-3 rounded-lg border md:col-span-2">
                  <div className="flex justify-between">
                    <Label>Fragment Size</Label>
                    <Badge variant="outline">{config.playerConfig.fragmentSize}s</Badge>
                  </div>
                  <Slider
                    value={[config.playerConfig.fragmentSize]}
                    min={1}
                    max={10}
                    step={1}
                    disabled={!editedConfig}
                    onValueChange={([value]) => 
                      setEditedConfig(prev => prev ? {
                        ...prev,
                        playerConfig: { ...prev.playerConfig, fragmentSize: value }
                      } : null)
                    }
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="paths" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Source Path</Label>
                  <Input 
                    value={config.paths.src} 
                    disabled={!editedConfig}
                    onChange={(e) => 
                      setEditedConfig(prev => prev ? {
                        ...prev,
                        paths: { ...prev.paths, src: e.target.value }
                      } : null)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Build Path</Label>
                  <Input 
                    value={config.paths.build} 
                    disabled={!editedConfig}
                    onChange={(e) => 
                      setEditedConfig(prev => prev ? {
                        ...prev,
                        paths: { ...prev.paths, build: e.target.value }
                      } : null)
                    }
                  />
                </div>
                {config.paths.assets && (
                  <div className="space-y-2">
                    <Label>Assets Path</Label>
                    <Input 
                      value={config.paths.assets} 
                      disabled={!editedConfig}
                      onChange={(e) => 
                        setEditedConfig(prev => prev ? {
                          ...prev,
                          paths: { ...prev.paths, assets: e.target.value }
                        } : null)
                      }
                    />
                  </div>
                )}
                {config.developerAccount && (
                  <div className="space-y-2">
                    <Label>Developer Account</Label>
                    <Input 
                      value={config.developerAccount} 
                      disabled={!editedConfig}
                      onChange={(e) => 
                        setEditedConfig(prev => prev ? {
                          ...prev,
                          developerAccount: e.target.value
                        } : null)
                      }
                    />
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="scripts" className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label>Compile Script</Label>
                  <Input 
                    value={config.scripts.compile} 
                    disabled={!editedConfig}
                    className="font-mono text-sm"
                  />
                </div>
                {config.scripts.sign && (
                  <div className="space-y-2">
                    <Label>Sign Script</Label>
                    <Input 
                      value={config.scripts.sign} 
                      disabled={!editedConfig}
                      className="font-mono text-sm"
                    />
                  </div>
                )}
                {config.scripts.test && (
                  <div className="space-y-2">
                    <Label>Test Script</Label>
                    <Input 
                      value={config.scripts.test} 
                      disabled={!editedConfig}
                      className="font-mono text-sm"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Deploy Script</Label>
                  <Input 
                    value={config.scripts.deploy} 
                    disabled={!editedConfig}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
