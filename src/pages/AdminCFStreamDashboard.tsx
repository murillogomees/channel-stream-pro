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
} from "@/components/admin/cfstream";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Cloud, AlertTriangle } from "lucide-react";

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
            Monitoramento e gestão de uploads de vídeo
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
    </div>
  );
}
