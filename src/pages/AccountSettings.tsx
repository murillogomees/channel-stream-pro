/**
 * PÁGINA DE CONFIGURAÇÕES DA CONTA
 * @version 1.0.0
 * 
 * Gerenciamento de sessões, MFA, senha, etc.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Key, Smartphone, Monitor, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SessionManager } from '@/components/auth/SessionManager';
import { MFASetup } from '@/components/auth/MFASetup';
import { UpdatePasswordForm } from '@/components/auth/UpdatePasswordForm';
import { useAuth } from '@/contexts/AuthContext';

export default function AccountSettings() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('security');

  const handleLogoutAllDevices = async () => {
    // This will be handled by SessionManager component
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Configurações da Conta</h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 h-auto p-1">
            <TabsTrigger value="security" className="flex items-center gap-2 py-3">
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">Segurança</span>
            </TabsTrigger>
            <TabsTrigger value="sessions" className="flex items-center gap-2 py-3">
              <Monitor className="w-4 h-4" />
              <span className="hidden sm:inline">Sessões</span>
            </TabsTrigger>
            <TabsTrigger value="mfa" className="flex items-center gap-2 py-3">
              <Smartphone className="w-4 h-4" />
              <span className="hidden sm:inline">2FA</span>
            </TabsTrigger>
          </TabsList>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="w-5 h-5 text-primary" />
                    Alterar Senha
                  </CardTitle>
                  <CardDescription>
                    Atualize sua senha regularmente para manter sua conta segura
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <UpdatePasswordForm />
                </CardContent>
              </Card>

              <Card className="mt-6 border-destructive/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <LogOut className="w-5 h-5" />
                    Sair de Todos os Dispositivos
                  </CardTitle>
                  <CardDescription>
                    Encerra todas as sessões ativas, incluindo esta
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="destructive"
                    onClick={signOut}
                    className="w-full sm:w-auto"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sair de todos os dispositivos
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Sessions Tab */}
          <TabsContent value="sessions">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Monitor className="w-5 h-5 text-primary" />
                    Sessões Ativas
                  </CardTitle>
                  <CardDescription>
                    Gerencie os dispositivos conectados à sua conta
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <SessionManager />
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* MFA Tab */}
          <TabsContent value="mfa">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-primary" />
                    Autenticação de Dois Fatores (2FA)
                  </CardTitle>
                  <CardDescription>
                    Adicione uma camada extra de segurança à sua conta
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <MFASetup />
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
