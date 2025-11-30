/**
 * Admin CDN Page
 * 
 * R2 CDN management, monitoring and content routing
 */

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CdnDashboard, ContentRoutingDashboard } from '@/components/admin/cdn';
import { HardDrive, GitBranch } from 'lucide-react';

export default function AdminCdn() {
  return (
    <div className="container mx-auto py-6 px-4">
      <Tabs defaultValue="routing" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="routing" className="gap-2">
            <GitBranch className="h-4 w-4" />
            Content Routing
          </TabsTrigger>
          <TabsTrigger value="cdn" className="gap-2">
            <HardDrive className="h-4 w-4" />
            CDN Storage
          </TabsTrigger>
        </TabsList>

        <TabsContent value="routing">
          <ContentRoutingDashboard />
        </TabsContent>

        <TabsContent value="cdn">
          <CdnDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
