/**
 * Admin CDN Page
 * 
 * R2 CDN management and monitoring
 */

import React from 'react';
import { CdnDashboard } from '@/components/admin/cdn';

export default function AdminCdn() {
  return (
    <div className="container mx-auto py-6 px-4">
      <CdnDashboard />
    </div>
  );
}
