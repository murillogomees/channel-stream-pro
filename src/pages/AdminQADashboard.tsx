/**
 * Admin QA Dashboard
 * 
 * Comprehensive QA, Performance & Security monitoring page
 */

import { useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Shield, 
  Activity, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  Download,
  Play,
  Clock,
  Gauge,
  Lock,
  Zap
} from 'lucide-react';
import { useQAValidation, type ValidationResult } from '@/hooks/useQAValidation';
import { useSecurityAudit, type SecurityFinding } from '@/hooks/useSecurityAudit';
import { toast } from 'sonner';

export default function AdminQADashboard() {
  const [activeTab, setActiveTab] = useState('qa');
  
  const { 
    report: qaReport, 
    isLoading: qaLoading, 
    runValidation,
    getStatusColor,
    getStatusIcon,
  } = useQAValidation();
  
  const {
    report: securityReport,
    isLoading: securityLoading,
    runAudit,
    getSeverityColor,
    getScoreColor,
  } = useSecurityAudit();

  const handleRunQA = async () => {
    await runValidation('full');
  };

  const handleRunSecurity = async () => {
    await runAudit('full');
  };

  const exportReport = () => {
    const report = {
      generated_at: new Date().toISOString(),
      qa: qaReport,
      security: securityReport,
    };
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qa-security-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report exported');
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6" />
              QA & Security Dashboard
            </h1>
            <p className="text-muted-foreground">
              Performance, security validation & load testing
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRunQA} disabled={qaLoading}>
              <Play className={`h-4 w-4 mr-2 ${qaLoading ? 'animate-pulse' : ''}`} />
              Run QA
            </Button>
            <Button variant="outline" onClick={handleRunSecurity} disabled={securityLoading}>
              <Shield className={`h-4 w-4 mr-2 ${securityLoading ? 'animate-pulse' : ''}`} />
              Security Audit
            </Button>
            <Button onClick={exportReport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                QA Tests
              </CardDescription>
              <CardTitle className="text-2xl">
                {qaReport ? `${qaReport.passed}/${qaReport.total_tests}` : '-/-'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {qaReport && (
                <Progress 
                  value={(qaReport.passed / qaReport.total_tests) * 100} 
                  className="h-2"
                />
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Shield className="h-4 w-4" />
                Security Score
              </CardDescription>
              <CardTitle className={`text-2xl ${securityReport ? getScoreColor(securityReport.overall_score) : ''}`}>
                {securityReport ? `${securityReport.overall_score}/100` : '-/100'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {securityReport && (
                <Progress 
                  value={securityReport.overall_score} 
                  className="h-2"
                />
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Startup p50
              </CardDescription>
              <CardTitle className="text-2xl">
                {qaReport?.metrics?.startup_p50_ms 
                  ? `${qaReport.metrics.startup_p50_ms}ms` 
                  : 'N/A'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-xs text-muted-foreground">Target: &lt;3000ms</span>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Zap className="h-4 w-4" />
                Cache Hit Rate
              </CardDescription>
              <CardTitle className="text-2xl">
                {qaReport?.metrics?.cache_hit_rate 
                  ? `${(qaReport.metrics.cache_hit_rate * 100).toFixed(0)}%` 
                  : 'N/A'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-xs text-muted-foreground">Target: &gt;70%</span>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="qa" className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4" />
              QA Validation
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-1">
              <Lock className="h-4 w-4" />
              Security Audit
            </TabsTrigger>
            <TabsTrigger value="performance" className="flex items-center gap-1">
              <Gauge className="h-4 w-4" />
              Performance
            </TabsTrigger>
            <TabsTrigger value="loadtest" className="flex items-center gap-1">
              <Activity className="h-4 w-4" />
              Load Testing
            </TabsTrigger>
          </TabsList>

          {/* QA Validation Tab */}
          <TabsContent value="qa" className="space-y-4">
            {qaReport ? (
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Validation Results</CardTitle>
                      <CardDescription>
                        Last run: {new Date(qaReport.timestamp).toLocaleString()}
                      </CardDescription>
                    </div>
                    <Badge 
                      variant={qaReport.overall_status === 'pass' ? 'default' : 
                               qaReport.overall_status === 'partial' ? 'secondary' : 'destructive'}
                    >
                      {qaReport.overall_status.toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Test</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {qaReport.results.map((result: ValidationResult, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">
                            {result.test.replace(/_/g, ' ')}
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(result.status)}>
                              {getStatusIcon(result.status)} {result.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{result.duration_ms}ms</TableCell>
                          <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                            {result.error || JSON.stringify(result.details || {})}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Click "Run QA" to perform validation tests
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-4">
            {securityReport ? (
              <>
                {/* Summary */}
                <div className="grid grid-cols-5 gap-4">
                  <Card className="border-red-200 bg-red-50">
                    <CardContent className="pt-4 text-center">
                      <p className="text-2xl font-bold text-red-600">{securityReport.summary.critical}</p>
                      <p className="text-sm text-red-600">Critical</p>
                    </CardContent>
                  </Card>
                  <Card className="border-orange-200 bg-orange-50">
                    <CardContent className="pt-4 text-center">
                      <p className="text-2xl font-bold text-orange-600">{securityReport.summary.high}</p>
                      <p className="text-sm text-orange-600">High</p>
                    </CardContent>
                  </Card>
                  <Card className="border-yellow-200 bg-yellow-50">
                    <CardContent className="pt-4 text-center">
                      <p className="text-2xl font-bold text-yellow-600">{securityReport.summary.medium}</p>
                      <p className="text-sm text-yellow-600">Medium</p>
                    </CardContent>
                  </Card>
                  <Card className="border-blue-200 bg-blue-50">
                    <CardContent className="pt-4 text-center">
                      <p className="text-2xl font-bold text-blue-600">{securityReport.summary.low}</p>
                      <p className="text-sm text-blue-600">Low</p>
                    </CardContent>
                  </Card>
                  <Card className="border-gray-200 bg-gray-50">
                    <CardContent className="pt-4 text-center">
                      <p className="text-2xl font-bold text-gray-600">{securityReport.summary.info}</p>
                      <p className="text-sm text-gray-600">Info</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Findings */}
                <Card>
                  <CardHeader>
                    <CardTitle>Security Findings</CardTitle>
                    <CardDescription>
                      {securityReport.findings.length} findings from security audit
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {securityReport.findings.map((finding: SecurityFinding, idx: number) => (
                        <div key={idx} className="border rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <Badge className={getSeverityColor(finding.severity)}>
                                  {finding.severity}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{finding.category}</span>
                              </div>
                              <h4 className="font-medium mt-2">{finding.title}</h4>
                              <p className="text-sm text-muted-foreground mt-1">{finding.description}</p>
                              {finding.remediation && (
                                <p className="text-sm text-blue-600 mt-2">
                                  <strong>Fix:</strong> {finding.remediation}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Recommendations */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc list-inside space-y-2">
                      {securityReport.recommendations.map((rec: string, idx: number) => (
                        <li key={idx} className="text-sm">{rec}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Click "Security Audit" to perform security analysis
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Performance Targets</CardTitle>
                <CardDescription>QA checklist performance benchmarks</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Metric</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Cold start to first frame</TableCell>
                      <TableCell>&lt; 3.0s</TableCell>
                      <TableCell><Badge variant="secondary">Pending</Badge></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Manifest load time</TableCell>
                      <TableCell>&lt; 1.0s</TableCell>
                      <TableCell><Badge variant="secondary">Pending</Badge></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Rebuffer events per hour</TableCell>
                      <TableCell>&lt; 2</TableCell>
                      <TableCell><Badge variant="secondary">Pending</Badge></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Frame drop rate</TableCell>
                      <TableCell>&lt; 1%</TableCell>
                      <TableCell><Badge variant="secondary">Pending</Badge></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Cache hit rate</TableCell>
                      <TableCell>&gt; 70%</TableCell>
                      <TableCell>
                        {qaReport?.metrics?.cache_hit_rate ? (
                          <Badge variant={qaReport.metrics.cache_hit_rate > 0.7 ? 'default' : 'destructive'}>
                            {(qaReport.metrics.cache_hit_rate * 100).toFixed(0)}%
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Pending</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Load Testing Tab */}
          <TabsContent value="loadtest" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>K6 Load Testing</CardTitle>
                <CardDescription>1000 concurrent user simulation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted p-4 rounded-lg font-mono text-sm">
                  <p className="text-muted-foreground mb-2"># Run load test locally:</p>
                  <code>k6 run --vus 1000 --duration 5m tests/load/k6-load-test.js</code>
                  <br /><br />
                  <p className="text-muted-foreground mb-2"># Quick test (100 VUs):</p>
                  <code>k6 run --vus 100 --iterations 500 tests/load/k6-load-test.js</code>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Thresholds</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm space-y-1">
                      <p>• p50 latency &lt; 500ms</p>
                      <p>• p95 latency &lt; 2000ms</p>
                      <p>• Error rate &lt; 5%</p>
                      <p>• Startup p50 &lt; 3000ms</p>
                      <p>• Cache hit &gt; 70%</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Scenarios</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm space-y-1">
                      <p>• Warm-up: 0 → 1000 VUs</p>
                      <p>• Constant: 500 VUs for 5m</p>
                      <p>• Spike: 100 → 1000 → 100</p>
                      <p>• Mixed: 70% VOD, 30% Live</p>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pentest Checklist</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Check</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Token validation</TableCell>
                      <TableCell>JWT signatures verified, expiration enforced</TableCell>
                      <TableCell><CheckCircle2 className="h-4 w-4 text-green-500" /></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Hotlink protection</TableCell>
                      <TableCell>Referrer and IP restrictions available</TableCell>
                      <TableCell><CheckCircle2 className="h-4 w-4 text-green-500" /></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Rate limiting</TableCell>
                      <TableCell>Request and bandwidth limits enforced</TableCell>
                      <TableCell><CheckCircle2 className="h-4 w-4 text-green-500" /></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>RLS policies</TableCell>
                      <TableCell>Row-level security on all user tables</TableCell>
                      <TableCell><CheckCircle2 className="h-4 w-4 text-green-500" /></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Secret exposure</TableCell>
                      <TableCell>No secrets in logs or client code</TableCell>
                      <TableCell><CheckCircle2 className="h-4 w-4 text-green-500" /></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>CORS configuration</TableCell>
                      <TableCell>Appropriate origin restrictions</TableCell>
                      <TableCell><AlertTriangle className="h-4 w-4 text-yellow-500" /></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
