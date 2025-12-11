import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, AlertTriangle, CheckCircle2, Clock, Play, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { rlsCoverageService } from "@/services/rlsCoverageService";
import type { RLSCoverageReport } from "@/services/rlsCoverageService";

interface SecurityAuditReport {
  timestamp: string;
  audit_type: string;
  overall_score: number;
  findings: Array<{
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    category: string;
    title: string;
    description: string;
    remediation?: string;
    evidence?: Record<string, unknown>;
  }>;
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  recommendations: string[];
}

export function SecurityAuditDashboard() {
  const [rlsReport, setRlsReport] = useState<RLSCoverageReport | null>(null);
  const [securityReport, setSecurityReport] = useState<SecurityAuditReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const { toast } = useToast();

  const runRLSAudit = async () => {
    setLoading(true);
    try {
      const report = await rlsCoverageService.runScan();
      setRlsReport(report);
      toast({
        title: "RLS Audit Completed",
        description: `Found ${report.total_issues} issues`,
      });
    } catch (error: any) {
      toast({
        title: "RLS Audit Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const runSecurityAudit = async (type: string = 'full') => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('security-audit', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (error) throw error;
      setSecurityReport(data);
      toast({
        title: "Security Audit Completed",
        description: `Security Score: ${data.overall_score}/100`,
      });
    } catch (error: any) {
      toast({
        title: "Security Audit Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const runFullAudit = async () => {
    await Promise.all([runRLSAudit(), runSecurityAudit()]);
  };

  const getSeverityVariant = (severity: string): "destructive" | "default" | "secondary" => {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Security Audit Dashboard</h2>
          <p className="text-muted-foreground">
            Comprehensive security analysis and RLS coverage
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={runRLSAudit} disabled={loading}>
            <Shield className="mr-2 h-4 w-4" />
            RLS Audit
          </Button>
          <Button onClick={() => runSecurityAudit()} disabled={loading}>
            <AlertTriangle className="mr-2 h-4 w-4" />
            Security Scan
          </Button>
          <Button onClick={runFullAudit} disabled={loading} variant="default">
            <Play className="mr-2 h-4 w-4" />
            Full Audit
          </Button>
        </div>
      </div>

      {/* Score Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Score</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {securityReport ? `${securityReport.overall_score}/100` : '--'}
            </div>
            <p className="text-xs text-muted-foreground">
              {securityReport && securityReport.timestamp ? (
                <>Last scanned: {new Date(securityReport.timestamp).toLocaleString()}</>
              ) : (
                'No scan data'
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">RLS Coverage</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {rlsReport ? `${rlsReport.summary.coverage_percentage}%` : '--'}
            </div>
            <p className="text-xs text-muted-foreground">
              {rlsReport ? (
                <>
                  {rlsReport.summary.total_tables - rlsReport.summary.tables_without_rls}/
                  {rlsReport.summary.total_tables} tables protected
                </>
              ) : (
                'No scan data'
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Issues</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {securityReport 
                ? securityReport.summary.critical + securityReport.summary.high
                : (rlsReport?.by_severity.high || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Require immediate attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="rls">RLS Issues</TabsTrigger>
          <TabsTrigger value="security">Security Findings</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Audit Status</CardTitle>
              <CardDescription>Current security posture and recent scans</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!rlsReport && !securityReport && (
                <Alert>
                  <Clock className="h-4 w-4" />
                  <AlertDescription>
                    No audit data available. Click "Full Audit" to run complete security analysis.
                  </AlertDescription>
                </Alert>
              )}

              {securityReport && (
                <div className="space-y-2">
                  <h4 className="font-semibold">Security Summary</h4>
                  <div className="grid grid-cols-5 gap-2">
                    {(['critical', 'high', 'medium', 'low', 'info'] as const).map((severity) => (
                      <div key={severity} className="text-center">
                        <Badge variant={getSeverityVariant(severity)}>
                          {securityReport.summary[severity]}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1 capitalize">{severity}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {rlsReport && (
                <div className="space-y-2">
                  <h4 className="font-semibold">RLS Summary</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Tables without RLS</p>
                      <p className="text-2xl font-bold">{rlsReport.summary.tables_without_rls}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Permissive Policies</p>
                      <p className="text-2xl font-bold">{rlsReport.summary.permissive_policies}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Issues</p>
                      <p className="text-2xl font-bold">{rlsReport.total_issues}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rls" className="space-y-4">
          {rlsReport?.issues.map((issue, idx) => (
            <Card key={idx}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={getSeverityVariant(issue.severity)}>
                        {issue.severity}
                      </Badge>
                      <CardTitle className="text-lg">{issue.table}</CardTitle>
                    </div>
                    <CardDescription>{issue.issue}</CardDescription>
                  </div>
                  <Button variant="outline" size="sm">
                    <FileText className="mr-2 h-4 w-4" />
                    View Fix
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <p className="text-sm font-medium">Evidence:</p>
                    <ul className="text-sm text-muted-foreground list-disc list-inside">
                      {issue.evidence.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </div>
                  {issue.proposed_fix && (
                    <div>
                      <p className="text-sm font-medium">Proposed Fix:</p>
                      <p className="text-sm text-muted-foreground">{issue.proposed_fix.summary}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          {securityReport?.findings.map((finding, idx) => (
            <Card key={idx}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={getSeverityVariant(finding.severity)}>
                        {finding.severity}
                      </Badge>
                      <Badge variant="outline">{finding.category}</Badge>
                    </div>
                    <CardTitle className="text-lg">{finding.title}</CardTitle>
                    <CardDescription>{finding.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              {finding.remediation && (
                <CardContent>
                  <div>
                    <p className="text-sm font-medium">Remediation:</p>
                    <p className="text-sm text-muted-foreground">{finding.remediation}</p>
                  </div>
                  {finding.evidence && (
                    <div className="mt-2">
                      <p className="text-sm font-medium">Evidence:</p>
                      <pre className="text-xs text-muted-foreground bg-muted p-2 rounded mt-1">
                        {JSON.stringify(finding.evidence, null, 2)}
                      </pre>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Recommendations</CardTitle>
              <CardDescription>Suggested actions to improve security posture</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {securityReport?.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <span className="text-sm">{rec}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
