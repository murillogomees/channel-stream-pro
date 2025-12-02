/**
 * Admin Transcode Queue Page
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TranscodeQueueManager, 
  TranscodeBatchUpload,
  TranscodeCostAnalytics,
  TranscodeQualityComparison,
} from '@/components/admin/transcode';
import { Video, Upload, DollarSign, Maximize } from 'lucide-react';

export default function AdminTranscodeQueue() {
  const handleBatchSuccess = () => {
    // Refresh queue when batch completes
    window.location.reload();
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <Tabs defaultValue="queue" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="queue" className="flex items-center gap-2">
            <Video className="h-4 w-4" />
            Fila
          </TabsTrigger>
          <TabsTrigger value="batch" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Batch Upload
          </TabsTrigger>
          <TabsTrigger value="cost" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Custos
          </TabsTrigger>
          <TabsTrigger value="compare" className="flex items-center gap-2">
            <Maximize className="h-4 w-4" />
            Comparação
          </TabsTrigger>
        </TabsList>

        <TabsContent value="queue">
          <TranscodeQueueManager />
        </TabsContent>

        <TabsContent value="batch">
          <TranscodeBatchUpload onSuccess={handleBatchSuccess} />
        </TabsContent>

        <TabsContent value="cost">
          <TranscodeCostAnalytics />
        </TabsContent>

        <TabsContent value="compare">
          <TranscodeQualityComparison />
        </TabsContent>
      </Tabs>
    </div>
  );
}
