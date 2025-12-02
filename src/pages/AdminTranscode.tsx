/**
 * Admin Transcode Dashboard
 * 
 * Página dedicada ao gerenciamento completo do sistema de transcodificação
 */

import { TranscodeQueueManager } from '@/components/admin/transcode';

export default function AdminTranscode() {
  return (
    <div className="container mx-auto py-8 px-4">
      <TranscodeQueueManager />
    </div>
  );
}
