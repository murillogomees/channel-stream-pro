/**
 * Admin IPTV Management - Unified Page
 * All IPTV configuration in one place with tabs
 * Lazy loads tab content only when tab is selected
 */

import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AdminShell } from '@/components/admin/AdminShell';
import { ResponsivePageHeader } from '@/components/admin/ResponsivePageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tv, ListVideo, Calendar, Zap, Database, FlaskConical, Clapperboard } from 'lucide-react';

// Tab Components
import { IPTVChannelsTab } from '@/components/admin/iptv/tabs/IPTVChannelsTab';
import { IPTVSeriesTab } from '@/components/admin/iptv/tabs/IPTVSeriesTab';
import { IPTVPlaylistsTab } from '@/components/admin/iptv/tabs/IPTVPlaylistsTab';
import { IPTVEPGTab } from '@/components/admin/iptv/tabs/IPTVEPGTab';
import { IPTVTranscodeTab } from '@/components/admin/iptv/tabs/IPTVTranscodeTab';
import { IPTVCacheTab } from '@/components/admin/iptv/tabs/IPTVCacheTab';
import { IPTVLoadTestTab } from '@/components/admin/iptv/tabs/IPTVLoadTestTab';

const TABS = [
  { id: 'channels', label: 'Canais', icon: Tv },
  { id: 'series', label: 'Séries', icon: Clapperboard },
  { id: 'playlists', label: 'Playlists', icon: ListVideo },
  { id: 'epg', label: 'EPG', icon: Calendar },
  { id: 'transcode', label: 'Transcode', icon: Zap },
  { id: 'cache', label: 'Cache', icon: Database },
  { id: 'loadtest', label: 'Load Test', icon: FlaskConical },
] as const;

type TabId = typeof TABS[number]['id'];

export default function AdminIPTVPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get('tab') || 'channels') as TabId;
  
  // Track which tabs have been visited (for lazy loading)
  const [visitedTabs, setVisitedTabs] = useState<Set<TabId>>(() => new Set([currentTab]));

  const handleTabChange = useCallback((tab: string) => {
    setSearchParams({ tab });
    setVisitedTabs(prev => {
      if (prev.has(tab as TabId)) return prev;
      return new Set([...prev, tab as TabId]);
    });
  }, [setSearchParams]);

  // Only render tab content if it has been visited
  const shouldRenderTab = (tabId: TabId) => visitedTabs.has(tabId);

  return (
    <AdminShell backTo="/admin/dashboard">
      <div className="space-y-4 md:space-y-6">
        <ResponsivePageHeader
          title="IPTV Management"
          description="Canais, séries, playlists, EPG, transcode e cache"
        />

        <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <TabsTrigger
                key={id}
                value={id}
                className="flex-1 min-w-[80px] gap-2 data-[state=active]:bg-background"
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="mt-4">
            <TabsContent value="channels" className="m-0">
              {shouldRenderTab('channels') && <IPTVChannelsTab />}
            </TabsContent>

            <TabsContent value="series" className="m-0">
              {shouldRenderTab('series') && <IPTVSeriesTab />}
            </TabsContent>

            <TabsContent value="playlists" className="m-0">
              {shouldRenderTab('playlists') && <IPTVPlaylistsTab />}
            </TabsContent>

            <TabsContent value="epg" className="m-0">
              {shouldRenderTab('epg') && <IPTVEPGTab />}
            </TabsContent>

            <TabsContent value="transcode" className="m-0">
              {shouldRenderTab('transcode') && <IPTVTranscodeTab />}
            </TabsContent>

            <TabsContent value="cache" className="m-0">
              {shouldRenderTab('cache') && <IPTVCacheTab />}
            </TabsContent>

            <TabsContent value="loadtest" className="m-0">
              {shouldRenderTab('loadtest') && <IPTVLoadTestTab />}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </AdminShell>
  );
}