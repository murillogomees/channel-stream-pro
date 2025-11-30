/**
 * Admin Smart Cache Dashboard
 * 
 * Page for monitoring and controlling intelligent cache system.
 */

import { SmartCacheMonitor } from '@/components/admin/cache';

export default function AdminSmartCache() {
  return (
    <div className="container mx-auto py-8 px-4">
      <SmartCacheMonitor />
    </div>
  );
}
