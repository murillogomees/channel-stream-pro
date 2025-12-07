/**
 * PwaConfigPanel - Main PWA configuration panel
 */

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, RotateCcw, Settings, Image, Cog, Bell, Download, FileJson } from 'lucide-react';
import { usePwaSettings } from './usePwaSettings';
import { PwaGeneralSettings } from './PwaGeneralSettings';
import { PwaIconsSettings } from './PwaIconsSettings';
import { PwaServiceWorkerSettings } from './PwaServiceWorkerSettings';
import { PwaPushSettings } from './PwaPushSettings';
import { PwaInstallSettings } from './PwaInstallSettings';
import { PwaManifestPreview } from './PwaManifestPreview';
import { toast } from 'sonner';

export function PwaConfigPanel() {
  const {
    settings,
    isLoading,
    isSaving,
    updateSettings,
    generateManifest,
    generateServiceWorker,
    uploadIcon,
    resetToDefaults,
  } = usePwaSettings();

  const [activeTab, setActiveTab] = useState('general');
  const [pendingChanges, setPendingChanges] = useState<Record<string, unknown>>({});

  const handleChange = (updates: Record<string, unknown>) => {
    setPendingChanges(prev => ({ ...prev, ...updates }));
  };

  const handleSave = async () => {
    if (Object.keys(pendingChanges).length > 0) {
      const success = await updateSettings(pendingChanges);
      if (success) {
        setPendingChanges({});
      }
    }
  };

  const handleReset = async () => {
    if (confirm('Restaurar todas as configurações para os valores padrão?')) {
      await resetToDefaults();
      setPendingChanges({});
      toast.success('Configurações restauradas');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Erro ao carregar configurações PWA
      </div>
    );
  }

  const mergedSettings = { ...settings, ...pendingChanges };
  const hasPendingChanges = Object.keys(pendingChanges).length > 0;

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuração PWA
          </h3>
          <p className="text-sm text-muted-foreground">
            Configure seu Progressive Web App
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasPendingChanges && (
            <Badge variant="outline" className="text-amber-500 border-amber-500/50">
              Alterações pendentes
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={handleReset} disabled={isSaving}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Resetar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!hasPendingChanges || isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            Salvar
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 gap-1 h-auto p-1">
          <TabsTrigger value="general" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Geral</span>
          </TabsTrigger>
          <TabsTrigger value="icons" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <Image className="h-4 w-4" />
            <span className="hidden sm:inline">Ícones</span>
          </TabsTrigger>
          <TabsTrigger value="sw" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <Cog className="h-4 w-4" />
            <span className="hidden sm:inline">Service Worker</span>
          </TabsTrigger>
          <TabsTrigger value="push" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Push</span>
          </TabsTrigger>
          <TabsTrigger value="install" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Instalação</span>
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <FileJson className="h-4 w-4" />
            <span className="hidden sm:inline">Preview</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <PwaGeneralSettings settings={mergedSettings as any} onChange={handleChange} />
        </TabsContent>

        <TabsContent value="icons" className="mt-6">
          <PwaIconsSettings 
            settings={mergedSettings as any} 
            onChange={handleChange}
            onUpload={uploadIcon}
          />
        </TabsContent>

        <TabsContent value="sw" className="mt-6">
          <PwaServiceWorkerSettings settings={mergedSettings as any} onChange={handleChange} />
        </TabsContent>

        <TabsContent value="push" className="mt-6">
          <PwaPushSettings settings={mergedSettings as any} onChange={handleChange} />
        </TabsContent>

        <TabsContent value="install" className="mt-6">
          <PwaInstallSettings settings={mergedSettings as any} onChange={handleChange} />
        </TabsContent>

        <TabsContent value="preview" className="mt-6">
          <PwaManifestPreview 
            manifest={generateManifest()} 
            serviceWorkerCode={generateServiceWorker()}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
