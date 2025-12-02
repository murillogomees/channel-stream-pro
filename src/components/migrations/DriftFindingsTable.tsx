import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { AlertCircle, CheckCircle2, Code, Play, Loader2, Eye } from 'lucide-react';
import { migrationAutomationService, DriftFinding } from '@/services/migrationAutomationService';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';

export function DriftFindingsTable() {
  const [findings, setFindings] = useState<DriftFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFinding, setSelectedFinding] = useState<DriftFinding | null>(null);
  const [applying, setApplying] = useState(false);
  const [showSqlDialog, setShowSqlDialog] = useState(false);

  useEffect(() => {
    loadFindings();
  }, []);

  const loadFindings = async () => {
    setLoading(true);
    try {
      const data = await migrationAutomationService.getRecentDriftFindings();
      setFindings(data);
    } catch (error) {
      console.error('[Findings] Error:', error);
      toast.error('Failed to load findings');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFix = async (finding: DriftFinding, dryRun: boolean = false) => {
    setApplying(true);
    try {
      const result = await migrationAutomationService.applyFix(finding.id, dryRun);
      
      if (result.success) {
        if (dryRun) {
          toast.success('SQL validation passed', {
            description: 'Ready to apply'
          });
        } else {
          toast.success('Fix applied successfully', {
            description: `Applied in ${result.execution_time_ms}ms`
          });
          loadFindings(); // Reload to update UI
          setShowSqlDialog(false);
        }
      } else {
        toast.error('Failed to apply fix', {
          description: result.error
        });
      }
    } catch (error) {
      console.error('[Apply Fix] Error:', error);
      toast.error('Fix application failed');
    } finally {
      setApplying(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': 
      case 'high': 
        return <AlertCircle className="h-4 w-4" />;
      default: 
        return <CheckCircle2 className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (findings.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
          <h3 className="text-lg font-semibold mb-2">No drift detected</h3>
          <p className="text-muted-foreground">
            Your database schema is in sync with the expected state
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Schema Drift Findings</CardTitle>
          <CardDescription>
            {findings.length} unresolved findings requiring attention
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Severity</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Object</TableHead>
                <TableHead>Issue</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {findings.map((finding) => (
                <TableRow key={finding.id}>
                  <TableCell>
                    <Badge 
                      variant={getSeverityColor(finding.severity)}
                      className="gap-1"
                    >
                      {getSeverityIcon(finding.severity)}
                      {finding.severity}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{finding.object_type}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {finding.object_name}
                  </TableCell>
                  <TableCell className="max-w-md truncate">
                    <Badge variant="secondary">{finding.drift_type}</Badge>
                    <span className="ml-2 text-sm text-muted-foreground">
                      {finding.expected_state || 'Missing'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedFinding(finding);
                          setShowSqlDialog(true);
                        }}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View SQL
                      </Button>
                      {finding.severity === 'critical' || finding.severity === 'high' ? (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleApplyFix(finding, false)}
                          disabled={applying}
                        >
                          {applying ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Play className="h-3 w-3 mr-1" />
                          )}
                          Fix Now
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* SQL Preview Dialog */}
      <Dialog open={showSqlDialog} onOpenChange={setShowSqlDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Fix SQL Preview</DialogTitle>
            <DialogDescription>
              Review and apply the SQL fix for {selectedFinding?.object_name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium mb-1">Severity</p>
                <Badge variant={getSeverityColor(selectedFinding?.severity || '')}>
                  {selectedFinding?.severity}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Type</p>
                <Badge variant="outline">{selectedFinding?.object_type}</Badge>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">SQL Fix</p>
              <ScrollArea className="h-64 w-full rounded-md border bg-muted p-4">
                <pre className="text-sm font-mono">
                  <code>{selectedFinding?.fix_sql}</code>
                </pre>
              </ScrollArea>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSqlDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => selectedFinding && handleApplyFix(selectedFinding, true)}
              disabled={applying}
            >
              <Code className="h-4 w-4 mr-2" />
              Dry Run
            </Button>
            <Button
              variant="default"
              onClick={() => selectedFinding && handleApplyFix(selectedFinding, false)}
              disabled={applying}
            >
              {applying ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Apply Fix
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}