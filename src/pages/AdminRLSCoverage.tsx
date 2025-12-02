import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Shield, AlertTriangle, CheckCircle, RefreshCw, History, Code, ShieldCheck, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import AdminShell from "@/components/admin/AdminShell";

interface RLSTableInfo {
  schema_name: string;
  table_name: string;
  has_rls: boolean;
  policy_count: number;
  policies: Array<{
    policy_name: string;
    command: string;
    permissive: string;
  }>;
  severity: 'high' | 'medium' | 'low' | 'ok';
}

export default function AdminRLSCoverage() {
  const queryClient = useQueryClient();
  const [selectedTable, setSelectedTable] = useState<RLSTableInfo | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Fetch all tables with RLS info
  const { data: tables, isLoading, refetch } = useQuery({
    queryKey: ['rls-all-tables'],
    queryFn: async () => {
      // Get all tables without RLS
      const { data: tablesWithoutRLS, error: error1 } = await supabase
        .rpc('detect_tables_without_rls');

      if (error1) {
        console.error('Error detecting tables without RLS:', error1);
        throw error1;
      }

      // Get all RLS policies
      const { data: allPolicies, error: error2 } = await supabase
        .rpc('get_all_rls_policies');

      if (error2) {
        console.error('Error getting RLS policies:', error2);
        throw error2;
      }

      // Get permissive policies
      const { data: permissivePolicies, error: error3 } = await supabase
        .rpc('detect_permissive_policies');

      if (error3) {
        console.error('Error detecting permissive policies:', error3);
      }

      // Build comprehensive table list
      const tableMap = new Map<string, RLSTableInfo>();

      // Add tables without RLS (high severity)
      tablesWithoutRLS?.forEach((t: any) => {
        const key = `${t.schema_name}.${t.table_name}`;
        tableMap.set(key, {
          schema_name: t.schema_name,
          table_name: t.table_name,
          has_rls: false,
          policy_count: 0,
          policies: [],
          severity: 'high',
        });
      });

      // Add tables with policies
      const policyGroups = new Map<string, any[]>();
      allPolicies?.forEach((p: any) => {
        const key = `${p.schemaname}.${p.tablename}`;
        if (!policyGroups.has(key)) {
          policyGroups.set(key, []);
        }
        policyGroups.get(key)?.push({
          policy_name: p.policyname,
          command: p.cmd,
          permissive: p.permissive,
        });
      });

      policyGroups.forEach((policies, key) => {
        const [schema, table] = key.split('.');
        
        // Check if any policies are permissive
        const hasPermissive = permissivePolicies?.some(
          (pp: any) => pp.schema_name === schema && pp.table_name === table
        );

        tableMap.set(key, {
          schema_name: schema,
          table_name: table,
          has_rls: true,
          policy_count: policies.length,
          policies,
          severity: hasPermissive ? 'medium' : 'ok',
        });
      });

      return Array.from(tableMap.values()).sort((a, b) => {
        // Sort by severity first, then alphabetically
        const severityOrder = { high: 0, medium: 1, low: 2, ok: 3 };
        if (severityOrder[a.severity] !== severityOrder[b.severity]) {
          return severityOrder[a.severity] - severityOrder[b.severity];
        }
        return a.table_name.localeCompare(b.table_name);
      });
    },
  });

  const handleViewDetails = (table: RLSTableInfo) => {
    setSelectedTable(table);
    setShowDetailModal(true);
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'high':
        return <Badge variant="destructive">Critical</Badge>;
      case 'medium':
        return <Badge variant="default">Warning</Badge>;
      case 'low':
        return <Badge variant="secondary">Info</Badge>;
      case 'ok':
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">OK</Badge>;
      default:
        return <Badge variant="secondary">{severity}</Badge>;
    }
  };

  const stats = {
    total: tables?.length || 0,
    critical: tables?.filter(t => t.severity === 'high').length || 0,
    warning: tables?.filter(t => t.severity === 'medium').length || 0,
    ok: tables?.filter(t => t.severity === 'ok').length || 0,
    coverage: tables?.length 
      ? Math.round(((tables.filter(t => t.has_rls).length / tables.length) * 100))
      : 0,
  };

  if (isLoading) {
    return (
      <AdminShell title="RLS Coverage">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading RLS coverage data...</p>
          </div>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell 
      title="RLS Coverage & Security Audit"
      description="Row-Level Security status for all database tables"
    >
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tables</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">In public schema</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Critical Issues</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.critical}</div>
              <p className="text-xs text-muted-foreground">No RLS enabled</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Warnings</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">{stats.warning}</div>
              <p className="text-xs text-muted-foreground">Permissive policies</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Protected</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{stats.ok}</div>
              <p className="text-xs text-muted-foreground">Properly secured</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Coverage</CardTitle>
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.coverage}%</div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => refetch()} 
                className="mt-1 h-7 px-2"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Refresh
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Main Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Tables - RLS Status</CardTitle>
            <CardDescription>
              Complete list of database tables with Row-Level Security analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Table Name</TableHead>
                    <TableHead className="text-center">RLS Enabled</TableHead>
                    <TableHead className="text-center">Policies</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tables && tables.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No tables found
                      </TableCell>
                    </TableRow>
                  ) : (
                    tables?.map((table) => (
                      <TableRow key={`${table.schema_name}.${table.table_name}`}>
                        <TableCell>
                          {table.has_rls ? (
                            <ShieldCheck className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-destructive" />
                          )}
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {table.schema_name}.{table.table_name}
                          </code>
                        </TableCell>
                        <TableCell className="text-center">
                          {table.has_rls ? (
                            <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive mx-auto" />
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{table.policy_count}</Badge>
                        </TableCell>
                        <TableCell>{getSeverityBadge(table.severity)}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewDetails(table)}
                          >
                            <Code className="w-3 h-3 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Detail Modal */}
        <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                {selectedTable?.schema_name}.{selectedTable?.table_name}
              </DialogTitle>
              <DialogDescription>
                RLS configuration details and policies
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Status Overview */}
              <Alert>
                <AlertDescription>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <strong>RLS Enabled:</strong>{' '}
                      {selectedTable?.has_rls ? (
                        <span className="text-green-500">Yes</span>
                      ) : (
                        <span className="text-destructive">No</span>
                      )}
                    </div>
                    <div>
                      <strong>Policies:</strong> {selectedTable?.policy_count}
                    </div>
                    <div>
                      <strong>Severity:</strong> {selectedTable && getSeverityBadge(selectedTable.severity)}
                    </div>
                    <div>
                      <strong>Schema:</strong> {selectedTable?.schema_name}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>

              {/* Policies List */}
              {selectedTable && selectedTable.policies.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Active Policies:</h4>
                  <div className="space-y-2">
                    {selectedTable.policies.map((policy, idx) => (
                      <div key={idx} className="p-3 border rounded-lg bg-muted/50">
                        <div className="flex items-center justify-between mb-2">
                          <code className="text-xs font-semibold">{policy.policy_name}</code>
                          <Badge variant="outline">{policy.command}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Type: {policy.permissive}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>No policies configured!</strong>
                    <br />
                    This table has no Row-Level Security policies. All authenticated users may have unrestricted access.
                  </AlertDescription>
                </Alert>
              )}

              {/* Recommendations */}
              {selectedTable?.severity === 'high' && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Critical:</strong> Enable RLS and create appropriate policies to protect this table.
                  </AlertDescription>
                </Alert>
              )}

              {selectedTable?.severity === 'medium' && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Warning:</strong> Some policies may be too permissive. Review and tighten access controls.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDetailModal(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminShell>
  );
}