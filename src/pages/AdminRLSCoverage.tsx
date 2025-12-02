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
import { Checkbox } from "@/components/ui/checkbox";
import { Shield, AlertTriangle, CheckCircle, Play, History, Code } from "lucide-react";
import { rlsCoverageService, RLSIssue } from "@/services/rlsCoverageService";
import { toast } from "sonner";
import AdminShell from "@/components/admin/AdminShell";

export default function AdminRLSCoverage() {
  const queryClient = useQueryClient();
  const [selectedIssue, setSelectedIssue] = useState<RLSIssue | null>(null);
  const [showFixModal, setShowFixModal] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [isDryRun, setIsDryRun] = useState(true);

  // Fetch coverage data
  const { data: coverage, isLoading, refetch } = useQuery({
    queryKey: ['rls-coverage'],
    queryFn: () => rlsCoverageService.runScan(),
  });

  // Fetch scan history
  const { data: scanHistory } = useQuery({
    queryKey: ['rls-scan-history'],
    queryFn: () => rlsCoverageService.getScanHistory(),
  });

  // Fix mutation
  const fixMutation = useMutation({
    mutationFn: (params: any) => rlsCoverageService.applyFix(params),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message || 'Fix applied successfully!');
        queryClient.invalidateQueries({ queryKey: ['rls-coverage'] });
        queryClient.invalidateQueries({ queryKey: ['rls-scan-history'] });
        setShowFixModal(false);
        setSelectedIssue(null);
        setConfirmChecked(false);
      } else if (result.requires_master) {
        toast.error('Master role required for high severity fixes');
      } else {
        toast.error(result.error || 'Failed to apply fix');
      }
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const handleFixClick = (issue: RLSIssue) => {
    setSelectedIssue(issue);
    setShowFixModal(true);
    setIsDryRun(true);
    setConfirmChecked(false);
  };

  const handleApplyFix = async () => {
    if (!selectedIssue) return;

    await fixMutation.mutateAsync({
      issue_id: selectedIssue.id,
      severity: selectedIssue.severity,
      schema_name: selectedIssue.schema,
      table_name: selectedIssue.table,
      policy_name: selectedIssue.action,
      sql_apply: selectedIssue.proposed_fix.sql_apply,
      sql_rollback: selectedIssue.proposed_fix.rollback_sql,
      dry_run: isDryRun,
      confirm: !isDryRun && confirmChecked,
    });
  };

  const getSeverityBadge = (severity: string) => {
    const config = rlsCoverageService.formatSeverityBadge(severity);
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (isLoading) {
    return (
      <AdminShell title="RLS Coverage">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Scanning RLS policies...</p>
          </div>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell 
      title="RLS Coverage & Security Audit"
      description="Detect and fix Row-Level Security issues"
    >
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Issues</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{coverage?.total_issues || 0}</div>
              <p className="text-xs text-muted-foreground">Detected problems</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">High Severity</CardTitle>
              <Shield className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {coverage?.by_severity.high || 0}
              </div>
              <p className="text-xs text-muted-foreground">Requires immediate attention</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Coverage</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {coverage?.summary.coverage_percentage || 0}%
              </div>
              <p className="text-xs text-muted-foreground">Tables with RLS</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Last Scan</CardTitle>
              <History className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium">
                {coverage?.timestamp ? new Date(coverage.timestamp).toLocaleTimeString() : 'N/A'}
              </div>
              <Button variant="ghost" size="sm" onClick={() => refetch()} className="mt-2 h-7 px-2">
                Rescan
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="issues" className="space-y-4">
          <TabsList>
            <TabsTrigger value="issues">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Issues ({coverage?.total_issues || 0})
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="w-4 h-4 mr-2" />
              Scan History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="issues" className="space-y-4">
            {coverage && coverage.issues.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No RLS Issues Found!</h3>
                  <p className="text-muted-foreground text-center">
                    All tables have proper Row-Level Security policies configured.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Security Issues</CardTitle>
                  <CardDescription>
                    Review and fix RLS policy problems. High severity issues require Master role.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Severity</TableHead>
                          <TableHead>Table</TableHead>
                          <TableHead>Issue</TableHead>
                          <TableHead>Evidence</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {coverage?.issues.map((issue) => (
                          <TableRow key={issue.id}>
                            <TableCell className="font-mono text-xs">{issue.id}</TableCell>
                            <TableCell>{getSeverityBadge(issue.severity)}</TableCell>
                            <TableCell>
                              <code className="text-xs bg-muted px-2 py-1 rounded">
                                {issue.schema}.{issue.table}
                              </code>
                            </TableCell>
                            <TableCell>
                              {rlsCoverageService.formatIssueType(issue.issue)}
                            </TableCell>
                            <TableCell className="max-w-xs">
                              <div className="text-xs text-muted-foreground line-clamp-2">
                                {issue.evidence.join(', ')}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleFixClick(issue)}
                              >
                                <Code className="w-3 h-3 mr-1" />
                                Fix
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Scan History</CardTitle>
                <CardDescription>Previous RLS security scans and fixes</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {scanHistory?.map((scan: any) => (
                      <div
                        key={scan.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {scan.schema_name}.{scan.table_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {rlsCoverageService.formatIssueType(scan.issue_type)} •{' '}
                            {new Date(scan.created_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getSeverityBadge(scan.severity)}
                          <Badge variant={scan.status === 'fixed' ? 'default' : 'secondary'}>
                            {scan.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Fix Modal */}
        <Dialog open={showFixModal} onOpenChange={setShowFixModal}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Code className="w-5 h-5" />
                Preview RLS Fix: {selectedIssue?.id}
              </DialogTitle>
              <DialogDescription>
                {selectedIssue?.proposed_fix.summary}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-auto space-y-4">
              {/* Issue Details */}
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Table:</strong> {selectedIssue?.schema}.{selectedIssue?.table}
                  <br />
                  <strong>Severity:</strong> {selectedIssue && getSeverityBadge(selectedIssue.severity)}
                  <br />
                  <strong>Evidence:</strong>
                  <ul className="list-disc list-inside mt-2">
                    {selectedIssue?.evidence.map((e, i) => (
                      <li key={i} className="text-sm">{e}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>

              {/* SQL Preview */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">SQL to Execute:</h4>
                <ScrollArea className="h-48 w-full rounded-md border bg-muted p-4">
                  <pre className="text-xs font-mono whitespace-pre-wrap">
                    {isDryRun
                      ? selectedIssue?.proposed_fix.sql_dry_run
                      : selectedIssue?.proposed_fix.sql_apply}
                  </pre>
                </ScrollArea>
              </div>

              {/* Rollback SQL */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Rollback SQL (if needed):</h4>
                <ScrollArea className="h-32 w-full rounded-md border bg-muted p-4">
                  <pre className="text-xs font-mono whitespace-pre-wrap">
                    {selectedIssue?.proposed_fix.rollback_sql}
                  </pre>
                </ScrollArea>
              </div>

              {/* Confirmation */}
              {!isDryRun && (
                <div className="flex items-start space-x-2 p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-950">
                  <Checkbox
                    id="confirm"
                    checked={confirmChecked}
                    onCheckedChange={(checked) => setConfirmChecked(checked as boolean)}
                  />
                  <label
                    htmlFor="confirm"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    I understand this will modify database RLS policies. A backup will be created automatically.
                    {selectedIssue?.severity === 'high' && (
                      <span className="text-destructive font-semibold"> Master role required.</span>
                    )}
                  </label>
                </div>
              )}
            </div>

            <DialogFooter className="flex-shrink-0">
              <Button variant="outline" onClick={() => setShowFixModal(false)}>
                Cancel
              </Button>
              {isDryRun ? (
                <>
                  <Button onClick={handleApplyFix} variant="secondary">
                    <Play className="w-4 h-4 mr-2" />
                    Run Dry Run
                  </Button>
                  <Button onClick={() => setIsDryRun(false)}>
                    Proceed to Apply
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleApplyFix}
                  disabled={!confirmChecked || fixMutation.isPending}
                  variant="destructive"
                >
                  {fixMutation.isPending ? 'Applying...' : 'Confirm & Apply Fix'}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminShell>
  );
}