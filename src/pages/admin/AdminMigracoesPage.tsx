/**
 * Admin Migrations Page - Consolidated Migration Management
 * 
 * Combines all migration-related functionality:
 * - Migration Dashboard (Feature Flags, Data Cleanup, Audit Log)
 * - Schema Drift Detection & Scanner
 * - RLS Security Audit
 * - Migration History & Stats
 */

import { Database, Shield, RefreshCw, AlertTriangle, Clock, Flag, Trash2 } from 'lucide-react';
import { ResponsiveTabs } from '@/components/admin/ResponsiveTabs';
import { MigrationDashboard } from '@/components/admin/MigrationDashboard';
import { RLSAuditPanel } from '@/components/admin/RLSAuditPanel';
import { MigrationScanner } from '@/components/admin/MigrationScanner';
import { MigrationStats } from '@/components/migrations/MigrationStats';
import { DriftFindingsTable } from '@/components/migrations/DriftFindingsTable';
import { MigrationHistory } from '@/components/migrations/MigrationHistory';
import AdminShell from '@/components/admin/AdminShell';

export default function AdminMigracoesPage() {
  const migrationTabs = [
    { 
      value: 'dashboard', 
      label: 'Dashboard', 
      icon: <Flag className="h-4 w-4" />,
      content: <MigrationDashboard />
    },
    { 
      value: 'scanner', 
      label: 'Scanner', 
      icon: <RefreshCw className="h-4 w-4" />,
      content: (
        <div className="space-y-6">
          <MigrationStats />
          <MigrationScanner />
        </div>
      )
    },
    { 
      value: 'drift', 
      label: 'Schema Drift', 
      icon: <AlertTriangle className="h-4 w-4" />,
      content: <DriftFindingsTable />
    },
    { 
      value: 'security', 
      label: 'RLS Audit', 
      icon: <Shield className="h-4 w-4" />,
      content: <RLSAuditPanel />
    },
    { 
      value: 'history', 
      label: 'Histórico', 
      icon: <Clock className="h-4 w-4" />,
      content: <MigrationHistory />
    },
  ];

  return (
    <AdminShell 
      title="Migrações & Schema" 
      description="Gerenciamento de migrações, drift detection e auditoria de segurança"
    >
      <div className="space-y-6">
        <ResponsiveTabs
          defaultValue="dashboard"
          tabs={migrationTabs}
        />
      </div>
    </AdminShell>
  );
}
