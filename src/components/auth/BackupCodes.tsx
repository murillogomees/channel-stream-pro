/**
 * BackupCodes Component - Simplified for Supabase Cloud
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Key, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export function BackupCodes() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-muted">
            <Key className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-lg">Códigos de Backup</CardTitle>
            <CardDescription>Use quando não tiver acesso ao autenticador</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-center py-4">
          <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 mb-4">
            <AlertTriangle className="h-6 w-6 text-yellow-600 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Códigos de backup estão disponíveis através do MFA do Supabase.
              Ative a autenticação de dois fatores para gerar seus códigos.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
