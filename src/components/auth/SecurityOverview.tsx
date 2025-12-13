/**
 * SecurityOverview Component - Overview of account security status
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Shield, 
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Smartphone,
  Key,
  Mail,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { customAuthService } from '@/services/customAuthService';
import { useNavigate } from 'react-router-dom';

interface SecurityCheck {
  id: string;
  label: string;
  description: string;
  status: 'good' | 'warning' | 'bad';
  icon: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function SecurityOverview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [hasBackupCodes, setHasBackupCodes] = useState(false);
  const [emailVerified, setEmailVerified] = useState(true);
  const [passwordStrong, setPasswordStrong] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSecurity = async () => {
      try {
        const { data } = await customAuthService.getSecurityStatus();
        if (data) {
          setMfaEnabled(data.mfa_enabled || false);
          setHasBackupCodes(data.has_backup_codes || false);
          setEmailVerified(data.email_verified !== false);
          setPasswordStrong(data.password_strong !== false);
        }
      } catch (e) {
        console.error('Error checking security status:', e);
      } finally {
        setLoading(false);
      }
    };
    checkSecurity();
  }, []);

  const securityChecks: SecurityCheck[] = [
    {
      id: 'password',
      label: 'Senha forte',
      description: passwordStrong 
        ? 'Sua senha atende aos requisitos de segurança'
        : 'Recomendamos uma senha mais forte',
      status: passwordStrong ? 'good' : 'warning',
      icon: <Lock className="h-5 w-5" />,
      action: !passwordStrong ? {
        label: 'Alterar senha',
        onClick: () => navigate('/app/configuracoes?tab=senha')
      } : undefined
    },
    {
      id: 'mfa',
      label: 'Autenticação de dois fatores',
      description: mfaEnabled 
        ? 'MFA ativado para proteção extra'
        : 'Adicione uma camada extra de segurança',
      status: mfaEnabled ? 'good' : 'warning',
      icon: <Smartphone className="h-5 w-5" />,
      action: !mfaEnabled ? {
        label: 'Ativar MFA',
        onClick: () => navigate('/app/configuracoes?tab=seguranca')
      } : undefined
    },
    {
      id: 'backup',
      label: 'Códigos de backup',
      description: hasBackupCodes 
        ? 'Códigos de backup configurados'
        : 'Gere códigos para recuperação de conta',
      status: hasBackupCodes ? 'good' : (mfaEnabled ? 'warning' : 'bad'),
      icon: <Key className="h-5 w-5" />,
      action: !hasBackupCodes ? {
        label: 'Gerar códigos',
        onClick: () => navigate('/app/configuracoes?tab=seguranca')
      } : undefined
    },
    {
      id: 'email',
      label: 'E-mail verificado',
      description: emailVerified 
        ? 'Seu e-mail foi verificado'
        : 'Verifique seu e-mail para maior segurança',
      status: emailVerified ? 'good' : 'bad',
      icon: <Mail className="h-5 w-5" />,
      action: !emailVerified ? {
        label: 'Verificar e-mail',
        onClick: () => navigate('/verify-email')
      } : undefined
    },
  ];

  const goodCount = securityChecks.filter(c => c.status === 'good').length;
  const securityScore = Math.round((goodCount / securityChecks.length) * 100);

  const getScoreColor = () => {
    if (securityScore >= 75) return 'text-green-600';
    if (securityScore >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreIcon = () => {
    if (securityScore >= 75) return <ShieldCheck className="h-8 w-8 text-green-500" />;
    if (securityScore >= 50) return <Shield className="h-8 w-8 text-yellow-500" />;
    return <ShieldAlert className="h-8 w-8 text-red-500" />;
  };

  const getStatusIcon = (status: 'good' | 'warning' | 'bad') => {
    switch (status) {
      case 'good':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'bad':
        return <XCircle className="h-5 w-5 text-red-500" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-muted">
            <Shield className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-lg">Visão Geral de Segurança</CardTitle>
            <CardDescription>
              Status de proteção da sua conta
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Security Score */}
        <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
          {getScoreIcon()}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">Pontuação de Segurança</span>
              <span className={`text-2xl font-bold ${getScoreColor()}`}>
                {securityScore}%
              </span>
            </div>
            <Progress 
              value={securityScore} 
              className="h-2"
              indicatorClassName={
                securityScore >= 75 ? 'bg-green-500' :
                securityScore >= 50 ? 'bg-yellow-500' :
                'bg-red-500'
              }
            />
          </div>
        </div>

        {/* Security Checks */}
        <div className="space-y-3">
          {securityChecks.map((check) => (
            <div 
              key={check.id}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card"
            >
              <div className={`
                p-2 rounded-full
                ${check.status === 'good' ? 'bg-green-500/10' :
                  check.status === 'warning' ? 'bg-yellow-500/10' :
                  'bg-red-500/10'}
              `}>
                {check.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{check.label}</span>
                  {getStatusIcon(check.status)}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {check.description}
                </p>
              </div>
              {check.action && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={check.action.onClick}
                  className="shrink-0"
                >
                  {check.action.label}
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
