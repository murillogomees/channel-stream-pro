/**
 * Admin Migrations Automation Page
 * 
 * Schema drift detection and automatic fixes
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Clock, Database, RefreshCw, Shield, AlertTriangle } from 'lucide-react';
import { MigrationScanner } from '@/components/migrations/MigrationScanner';
import { DriftFindingsTable } from '@/components/migrations/DriftFindingsTable';
import { MigrationHistory } from '@/components/migrations/MigrationHistory';
import { MigrationStats } from '@/components/migrations/MigrationStats';

export default function AdminMigrations() {
  const [activeTab, setActiveTab] = useState('scanner');

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Database className="h-8 w-8" />
            Migrations Automation
          </h1>
          <p className="text-muted-foreground">
            Schema drift detection and automatic fix aplicat
ion
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-2">
            <Shield className="h-3 w-3" />
            Master Required
          </Badge>
        </div>
      </div>

      {/* Quick Stats */}
      <MigrationStats />

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="scanner" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Scanner
          </TabsTrigger>
          <TabsTrigger value="findings" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Drift Findings
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <Clock className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scanner" className="space-y-4">
          <MigrationScanner />
        </TabsContent>

        <TabsContent value="findings" className="space-y-4">
          <DriftFindingsTable />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <MigrationHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}