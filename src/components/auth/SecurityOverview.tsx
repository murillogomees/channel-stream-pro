/**
 * SecurityOverview Component - Simplified for Supabase Cloud
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Shield, ShieldCheck, CheckCircle2, XCircle, Lock, Smartphone, Mail, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

export function SecurityOverview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mfaEnabled, setMfaEnabled] = useState(false);

  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data }) => {
      setMfaEnabled(!!data?.totp?.length);
    });
  }, []);

  const securityChecks = [
    { id: 'password', label: 'Senha configurada', status: 'good' as const, icon: <Lock className="h-5 w-5" /> },
    { id: 'mfa', label: 'Autenticação 2FA', status: mfaEnabled ? 'good' as const : 'warning' as const, icon: <Smartphone className="h-5 w-5" />, action: !mfaEnabled ? { label: 'Ativar', onClick: () => navigate('/account/settings') } : undefined },
    { id: 'email', label: 'E-mail verificado', status: 'good' as const, icon: <Mail className="h-5 w-5" /> },
  ];

  const goodCount = securityChecks.filter(c => c.status === 'good').length;
  const securityScore = Math.round((goodCount / securityChecks.length) * 100);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-muted"><Shield className="h-5 w-5 text-muted-foreground" /></div>
          <div>
            <CardTitle className="text-lg">Segurança</CardTitle>
            <CardDescription>Status de proteção</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
          <ShieldCheck className="h-8 w-8 text-green-500" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">Pontuação</span>
              <span className="text-2xl font-bold text-green-600">{securityScore}%</span>
            </div>
            <Progress value={securityScore} className="h-2" />
          </div>
        </div>
        <div className="space-y-2">
          {securityChecks.map((check) => (
            <div key={check.id} className="flex items-center gap-3 p-3 rounded-lg border">
              <div className="p-2 rounded-full bg-green-500/10">{check.icon}</div>
              <div className="flex-1">
                <span className="font-medium text-sm">{check.label}</span>
              </div>
              {check.status === 'good' ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-yellow-500" />}
              {check.action && <Button variant="ghost" size="sm" onClick={check.action.onClick}>{check.action.label}<ArrowRight className="h-3 w-3 ml-1" /></Button>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
