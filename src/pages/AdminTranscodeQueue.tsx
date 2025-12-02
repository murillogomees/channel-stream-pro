/**
 * Admin Transcode Queue Page
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TranscodeQueueManager, 
  TranscodeBatchUpload,
  TranscodeCostAnalytics,
  TranscodeQualityComparison,
  TranscodeScheduler,
  TranscodePriorityManager,
  TranscodeBandwidthOptimizer,
  TranscodeConcurrencyLimiter,
  TranscodeWebhookRetry,
  TranscodeMLPredictor,
  TranscodeRealtimeMonitor,
  TranscodeCostForecasting,
  TranscodeAdvancedAnalytics,
} from '@/components/admin/transcode';
import { 
  Video, 
  Upload, 
  DollarSign, 
  Maximize, 
  Calendar,
  Zap,
  TrendingDown,
  Settings,
  Webhook,
  Brain,
  Activity,
  BarChart3,
} from 'lucide-react';

export default function AdminTranscodeQueue() {
  const handleBatchSuccess = () => {
    window.location.reload();
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <Tabs defaultValue="queue" className="space-y-6">
        <TabsList className="grid w-full grid-cols-13 max-w-full overflow-x-auto">
          <TabsTrigger value="queue" className="flex items-center gap-1 text-xs">
            <Video className="h-3 w-3" />
            Fila
          </TabsTrigger>
          <TabsTrigger value="batch" className="flex items-center gap-1 text-xs">
            <Upload className="h-3 w-3" />
            Batch
          </TabsTrigger>
          <TabsTrigger value="scheduler" className="flex items-center gap-1 text-xs">
            <Calendar className="h-3 w-3" />
            Agendar
          </TabsTrigger>
          <TabsTrigger value="priority" className="flex items-center gap-1 text-xs">
            <Zap className="h-3 w-3" />
            Prioridade
          </TabsTrigger>
          <TabsTrigger value="bandwidth" className="flex items-center gap-1 text-xs">
            <TrendingDown className="h-3 w-3" />
            Banda
          </TabsTrigger>
          <TabsTrigger value="concurrency" className="flex items-center gap-1 text-xs">
            <Settings className="h-3 w-3" />
            Concurrent
          </TabsTrigger>
          <TabsTrigger value="webhook" className="flex items-center gap-1 text-xs">
            <Webhook className="h-3 w-3" />
            Webhooks
          </TabsTrigger>
          <TabsTrigger value="cost" className="flex items-center gap-1 text-xs">
            <DollarSign className="h-3 w-3" />
            Custos
          </TabsTrigger>
          <TabsTrigger value="compare" className="flex items-center gap-1 text-xs">
            <Maximize className="h-3 w-3" />
            Compare
          </TabsTrigger>
          <TabsTrigger value="ml" className="flex items-center gap-1 text-xs">
            <Brain className="h-3 w-3" />
            ML
          </TabsTrigger>
          <TabsTrigger value="realtime" className="flex items-center gap-1 text-xs">
            <Activity className="h-3 w-3" />
            Monitor
          </TabsTrigger>
          <TabsTrigger value="forecast" className="flex items-center gap-1 text-xs">
            <DollarSign className="h-3 w-3" />
            Forecast
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-1 text-xs">
            <BarChart3 className="h-3 w-3" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="queue">
          <TranscodeQueueManager />
        </TabsContent>

        <TabsContent value="batch">
          <TranscodeBatchUpload onSuccess={handleBatchSuccess} />
        </TabsContent>

        <TabsContent value="scheduler">
          <TranscodeScheduler />
        </TabsContent>

        <TabsContent value="priority">
          <TranscodePriorityManager />
        </TabsContent>

        <TabsContent value="bandwidth">
          <TranscodeBandwidthOptimizer />
        </TabsContent>

        <TabsContent value="concurrency">
          <TranscodeConcurrencyLimiter />
        </TabsContent>

        <TabsContent value="webhook">
          <TranscodeWebhookRetry />
        </TabsContent>

        <TabsContent value="cost">
          <TranscodeCostAnalytics />
        </TabsContent>

        <TabsContent value="compare">
          <TranscodeQualityComparison />
        </TabsContent>

        <TabsContent value="ml">
          <TranscodeMLPredictor />
        </TabsContent>

        <TabsContent value="realtime">
          <TranscodeRealtimeMonitor />
        </TabsContent>

        <TabsContent value="forecast">
          <TranscodeCostForecasting />
        </TabsContent>

        <TabsContent value="analytics">
          <TranscodeAdvancedAnalytics />
        </TabsContent>
      </Tabs>
    </div>
  );
}
