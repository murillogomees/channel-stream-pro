/**
 * Admin CDN Page
 * 
 * R2 CDN management, monitoring and content routing
 */

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CdnDashboard, ContentRoutingDashboard, BulkDownloadPanel, CDNConfigPanel } from '@/components/admin/cdn';
import { HardDrive, GitBranch, Download, Settings } from 'lucide-react';

export default function AdminCdn() {
  return (
    <div className="container mx-auto py-6 px-4">
      <Tabs defaultValue="download" className="space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="download" className="gap-2">
            <Download className="h-4 w-4" />
            Download R2
          </TabsTrigger>
          <TabsTrigger value="routing" className="gap-2">
            <GitBranch className="h-4 w-4" />
            Routing
          </TabsTrigger>
          <TabsTrigger value="cdn" className="gap-2">
            <HardDrive className="h-4 w-4" />
            Storage
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-2">
            <Settings className="h-4 w-4" />
            Config
          </TabsTrigger>
        </TabsList>

        <TabsContent value="download">
          <BulkDownloadPanel />
        </TabsContent>

        <TabsContent value="routing">
          <ContentRoutingDashboard />
        </TabsContent>

        <TabsContent value="cdn">
          <CdnDashboard />
        </TabsContent>

        <TabsContent value="config">
          <CDNConfigPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
