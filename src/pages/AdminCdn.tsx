/**
 * Admin CDN Page
 * 
 * R2 CDN configuration
 */

import React from 'react';
import { CDNConfigPanel } from '@/components/admin/cdn';

export default function AdminCdn() {
  return (
    <div className="container mx-auto py-6 px-4">
      <CDNConfigPanel />
    </div>
  );
}
