/**
 * PwaIconsSettings - Upload e gerenciamento de ícones do PWA
 */

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Image, Upload, X, Check, AlertCircle, HelpCircle, Loader2 } from 'lucide-react';
import type { PwaSettings } from './types';

interface IconConfig {
  field: keyof PwaSettings;
  label: string;
  size: string;
  description: string;
  required: boolean;
}

const ICON_CONFIGS: IconConfig[] = [
  { field: 'icon_192', label: 'Ícone 192x192', size: '192x192', description: 'Ícone padrão para launcher', required: true },
  { field: 'icon_512', label: 'Ícone 512x512', size: '512x512', description: 'Ícone de alta resolução', required: true },
  { field: 'icon_maskable', label: 'Ícone Maskable', size: '512x512', description: 'Ícone adaptativo (safe zone 80%)', required: true },
  { field: 'favicon_16', label: 'Favicon 16x16', size: '16x16', description: 'Favicon pequeno para tabs', required: false },
  { field: 'favicon_32', label: 'Favicon 32x32', size: '32x32', description: 'Favicon padrão', required: false },
];

interface PwaIconsSettingsProps {
  settings: PwaSettings;
  onChange: (updates: Partial<PwaSettings>) => void;
  onUpload: (file: File, type: string) => Promise<string | null>;
  disabled?: boolean;
}

export function PwaIconsSettings({ settings, onChange, onUpload, disabled }: PwaIconsSettingsProps) {
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleFileSelect = async (field: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!['image/png', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return;
    }

    setUploading(field);
    try {
      const url = await onUpload(file, field);
      if (url) {
        onChange({ [field]: url });
      }
    } finally {
      setUploading(null);
    }
  };

  const handleRemove = (field: string) => {
    onChange({ [field]: null });
  };

  const triggerUpload = (field: string) => {
    fileInputRefs.current[field]?.click();
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Image className="h-4 w-4" />
          Ícones e Assets
        </CardTitle>
        <CardDescription>
          Upload dos ícones necessários para o PWA. Formatos aceitos: PNG, WebP, SVG
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ICON_CONFIGS.map((config) => {
            const value = settings[config.field] as string | null;
            const isUploading = uploading === config.field;

            return (
              <div
                key={config.field}
                className="relative border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">{config.label}</Label>
                    {config.required && (
                      <Badge variant="outline" className="text-xs">Obrigatório</Badge>
                    )}
                  </div>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{config.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">Tamanho: {config.size}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* Preview Area */}
                <div 
                  className={`
                    relative aspect-square rounded-lg border-2 border-dashed 
                    flex items-center justify-center overflow-hidden
                    transition-colors cursor-pointer
                    ${value ? 'border-primary/50 bg-primary/5' : 'border-muted-foreground/20 hover:border-muted-foreground/40'}
                    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                  onClick={() => !disabled && !isUploading && triggerUpload(config.field)}
                >
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <span className="text-xs text-muted-foreground">Enviando...</span>
                    </div>
                  ) : value ? (
                    <>
                      <img 
                        src={value} 
                        alt={config.label}
                        className="w-full h-full object-contain p-2"
                      />
                      <div className="absolute top-2 right-2 flex gap-1">
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemove(config.field);
                          }}
                          disabled={disabled}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="absolute bottom-2 left-2">
                        <Check className="h-4 w-4 text-green-500" />
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Upload className="h-8 w-8" />
                      <span className="text-xs">Clique para enviar</span>
                      <span className="text-xs">{config.size}</span>
                    </div>
                  )}
                </div>

                {/* Hidden file input */}
                <input
                  ref={(el) => fileInputRefs.current[config.field] = el}
                  type="file"
                  accept="image/png,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => handleFileSelect(config.field, e)}
                  disabled={disabled}
                />

                {/* Status */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{config.size}</span>
                  {value ? (
                    <span className="text-green-500 flex items-center gap-1">
                      <Check className="h-3 w-3" /> Enviado
                    </span>
                  ) : config.required ? (
                    <span className="text-amber-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> Pendente
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Opcional</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Info box */}
        <div className="mt-6 p-4 rounded-lg bg-muted/50 border">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Dicas para ícones</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Use imagens em PNG com fundo transparente para melhor resultado</li>
                <li>• O ícone maskable deve ter a área segura (80%) centralizada</li>
                <li>• Tamanho máximo por arquivo: 5MB</li>
                <li>• Formatos aceitos: PNG, WebP, SVG</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
