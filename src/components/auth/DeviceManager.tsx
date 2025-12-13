/**
 * DeviceManager Component - Manage trusted devices and fingerprints
 */

import { useState } from 'react';
import { useDeviceManagement } from '@/hooks/useAdvancedAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Smartphone, Laptop, Monitor, Tablet, Shield, ShieldCheck, Trash2, Loader2, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function getDeviceIcon(deviceType: string) {
  switch (deviceType?.toLowerCase()) {
    case 'mobile': return Smartphone;
    case 'tablet': return Tablet;
    case 'desktop': return Monitor;
    default: return Laptop;
  }
}

export function DeviceManager() {
  const { devices, loading, fetchDevices, trustDevice, removeDevice, getFingerprint } = useDeviceManagement();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const currentFingerprint = getFingerprint();

  const handleTrust = async (deviceId: string) => {
    setProcessingId(deviceId);
    await trustDevice(deviceId);
    setProcessingId(null);
  };

  const handleRemove = async (deviceId: string) => {
    setProcessingId(deviceId);
    await removeDevice(deviceId);
    setProcessingId(null);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Dispositivos
            </CardTitle>
            <CardDescription>
              Gerencie seus dispositivos conhecidos e confiáveis
            </CardDescription>
          </div>
          <Button variant="outline" size="icon" onClick={() => fetchDevices()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Device Info */}
        <div className="p-3 rounded-lg bg-muted/50 border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Laptop className="h-4 w-4" />
            <span>Dispositivo Atual</span>
          <Badge variant="secondary" className="ml-auto">
            {currentFingerprint.substring(0, 8)}...
            </Badge>
          </div>
        </div>

        {loading && devices.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : devices.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum dispositivo registrado ainda.
          </p>
        ) : (
          <div className="space-y-3">
            {devices.map((device) => {
              const DeviceIcon = getDeviceIcon(device.device_type);
              const isCurrentDevice = device.fingerprint_hash === currentFingerprint;
              const isProcessing = processingId === device.id;

              return (
                <div
                  key={device.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    isCurrentDevice ? 'bg-primary/5 border-primary/20' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${device.is_trusted ? 'bg-green-500/10' : 'bg-muted'}`}>
                      <DeviceIcon className={`h-4 w-4 ${device.is_trusted ? 'text-green-500' : ''}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {device.device_name || device.browser || 'Dispositivo desconhecido'}
                        </span>
                        {isCurrentDevice && (
                          <Badge variant="outline" className="text-xs">Este dispositivo</Badge>
                        )}
                        {device.is_trusted && (
                          <ShieldCheck className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {device.os} • Visto em {format(new Date(device.last_seen_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!device.is_trusted && !isCurrentDevice && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTrust(device.id)}
                        disabled={isProcessing}
                      >
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confiar'}
                      </Button>
                    )}
                    {!isCurrentDevice && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemove(device.id)}
                        disabled={isProcessing}
                        className="text-destructive hover:text-destructive"
                      >
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
