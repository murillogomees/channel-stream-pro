/**
 * AdminCFStreamDashboard - Dashboard de monitoramento Cloudflare Stream
 */

import { useState } from "react";
import { useCFStreamUploads } from "@/hooks/useCFStreamUploads";
import {
  CFStreamStatusCards,
  CFStreamUploadsList,
  CFStreamQuickActions,
  CFStreamSchedulerInfo,
  CFStreamMetricsDashboard,
  CFStreamRetryManager,
} from "@/components/admin/cfstream";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Cloud, 
  AlertTriangle, 
  ListVideo, 
  BarChart3, 
  RefreshCw 
} from "lucide-react";

export default function AdminCFStreamDashboard() {
  const { uploads, counts, isLoading, error, refresh, retryUpload, cancelUpload } = useCFStreamUploads();
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Cloud className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Cloudflare Stream</h2>
          <p className="text-sm text-muted-foreground">
            Monitoramento, métricas e gestão de uploads
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Status Cards */}
      <CFStreamStatusCards counts={counts} isLoading={isLoading} />

      {/* Tabs */}
      <Tabs defaultValue="uploads" className="space-y-4">
        <TabsList>
          <TabsTrigger value="uploads" className="flex items-center gap-2">
            <ListVideo className="h-4 w-4" />
            Uploads
          </TabsTrigger>
          <TabsTrigger value="metrics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Métricas
          </TabsTrigger>
          <TabsTrigger value="retry" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Retry
            {(counts.failed > 0 || counts.retry_scheduled > 0) && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-orange-500 text-white rounded-full">
                {counts.failed + counts.retry_scheduled}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="uploads">
          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Uploads List */}
            <div className="lg:col-span-3">
              <CFStreamUploadsList
                uploads={uploads}
                isLoading={isLoading}
                onRefresh={refresh}
                onRetry={retryUpload}
                onCancel={cancelUpload}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
              />
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              <CFStreamQuickActions 
                onRefresh={refresh} 
                counts={{
                  queued: counts.queued,
                  failed: counts.failed,
                  retry_scheduled: counts.retry_scheduled,
                }}
              />
              <CFStreamSchedulerInfo />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="metrics">
          <CFStreamMetricsDashboard />
        </TabsContent>

        <TabsContent value="retry">
          <CFStreamRetryManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
