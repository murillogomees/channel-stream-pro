/**
 * Admin Migrations Automation Page
 * 
 * Schema drift detection and automatic fixes
 */

import { Badge } from '@/components/ui/badge';
import { Database, RefreshCw, AlertTriangle, Clock, Shield, ArrowLeft } from 'lucide-react';
import { MigrationScanner } from '@/components/migrations/MigrationScanner';
import { DriftFindingsTable } from '@/components/migrations/DriftFindingsTable';
import { MigrationHistory } from '@/components/migrations/MigrationHistory';
import { MigrationStats } from '@/components/migrations/MigrationStats';
import { ResponsiveTabs } from '@/components/admin/ResponsiveTabs';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function AdminMigrations() {
  const navigate = useNavigate();

  const migrationTabs = [
    { 
      value: 'scanner', 
      label: 'Scanner', 
      icon: <RefreshCw className="h-4 w-4" />,
      content: <MigrationScanner />
    },
    { 
      value: 'findings', 
      label: 'Schema Drift', 
      icon: <AlertTriangle className="h-4 w-4" />,
      content: <DriftFindingsTable />
    },
    { 
      value: 'history', 
      label: 'Histórico', 
      icon: <Clock className="h-4 w-4" />,
      content: <MigrationHistory />
    },
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/admin')}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Database className="h-6 w-6 text-primary" />
              Migrações & Schema
            </h1>
            <p className="text-sm text-muted-foreground">
              Detecção de drift e correções automáticas
            </p>
          </div>
        </div>
        
        <Badge variant="outline" className="gap-2">
          <Shield className="h-3 w-3" />
          Master
        </Badge>
      </div>

      {/* Quick Stats */}
      <MigrationStats />

      {/* Tabs with Select Menu */}
      <ResponsiveTabs
        defaultValue="scanner"
        tabs={migrationTabs}
      />
    </div>
  );
}