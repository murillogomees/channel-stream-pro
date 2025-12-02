import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { migrationAutomationService } from '@/services/migrationAutomationService';
import { toast } from 'sonner';

export function MigrationScanner() {
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<any>(null);

  const handleScan = async () => {
    setScanning(true);
    try {
      const result = await migrationAutomationService.scanForDrift();
      setLastScan(result);
      
      if (result.summary.total_findings === 0) {
        toast.success('No schema drift detected', {
          description: 'Database schema is in sync with expected state'
        });
      } else {
        const criticalCount = result.summary.critical;
        if (criticalCount > 0) {
          toast.error(`Found ${criticalCount} critical issues`, {
            description: `Total: ${result.summary.total_findings} drift findings`
          });
        } else {
          toast.warning(`Found ${result.summary.total_findings} drift findings`, {
            description: 'Review and apply fixes in Drift Findings tab'
          });
        }
      }
    } catch (error) {
      console.error('[Scanner] Error:', error);
      toast.error('Scan failed', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setScanning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Schema Drift Scanner
        </CardTitle>
        <CardDescription>
          Scan database for schema drift and missing migrations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              Last scan: {lastScan ? new Date(lastScan.summary.scan_id).toLocaleString() : 'Never'}
            </p>
          </div>
          
          <Button 
            onClick={handleScan} 
            disabled={scanning}
            size="lg"
          >
            {scanning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Run Scan
              </>
            )}
          </Button>
        </div>

        {lastScan && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <Card className="bg-destructive/10 border-destructive/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Critical</p>
                    <p className="text-3xl font-bold">{lastScan.summary.critical}</p>
                  </div>
                  <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-orange-500/10 border-orange-500/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">High</p>
                    <p className="text-3xl font-bold">{lastScan.summary.high}</p>
                  </div>
                  <AlertCircle className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-yellow-500/10 border-yellow-500/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Medium</p>
                    <p className="text-3xl font-bold">{lastScan.summary.medium}</p>
                  </div>
                  <AlertCircle className="h-8 w-8 text-yellow-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-primary/10 border-primary/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-3xl font-bold">{lastScan.summary.total_findings}</p>
                  </div>
                  <CheckCircle2 className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
}