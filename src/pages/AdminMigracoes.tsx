/**
 * Admin Migrations Page - Complete Migration Management
 * 
 * Combines:
 * - Migration Dashboard (Feature Flags, Data Cleanup, Audit Log)
 * - RLS Security Audit
 * - Schema Drift Detection
 */

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Database, Shield, Flag, Wrench } from 'lucide-react';
import { MigrationDashboard } from '@/components/admin/MigrationDashboard';
import { RLSAuditPanel } from '@/components/admin/RLSAuditPanel';
import { MigrationScanner } from '@/components/admin/MigrationScanner';
import AdminShell from '@/components/admin/AdminShell';

export default function AdminMigracoes() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <AdminShell title="Migrations & Security">
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold">Migrations & Security</h1>
          <p className="text-muted-foreground">
            Gerenciamento completo de migrações, limpeza de dados e auditoria de segurança
          </p>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="dashboard">
              <Flag className="w-4 h-4 mr-2" />
              Migration Dashboard
            </TabsTrigger>
            <TabsTrigger value="security">
              <Shield className="w-4 h-4 mr-2" />
              RLS Security Audit
            </TabsTrigger>
            <TabsTrigger value="drift">
              <Wrench className="w-4 h-4 mr-2" />
              Schema Drift
            </TabsTrigger>
          </TabsList>

          {/* Migration Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-4">
            <MigrationDashboard />
          </TabsContent>

          {/* RLS Security Audit Tab */}
          <TabsContent value="security" className="space-y-4">
            <RLSAuditPanel />
          </TabsContent>

          {/* Schema Drift Detection Tab */}
          <TabsContent value="drift" className="space-y-4">
            <MigrationScanner />
          </TabsContent>
        </Tabs>
      </div>
    </AdminShell>
  );
}
