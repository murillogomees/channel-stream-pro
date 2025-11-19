export interface Channel {
  id: string;
  name: string;
  logo: string;
  url: string;
  category: string;
  tvgId?: string;
  tvgName?: string;
  groupTitle?: string;
}

export interface M3UPlaylist {
  channels: Channel[];
  categories: string[];
}

/**
 * Parse M3U playlist content
 */
export function parseM3U(content: string): M3UPlaylist {
  const lines = content.split('\n').map(line => line.trim());
  const channels: Channel[] = [];
  const categoriesSet = new Set<string>();
  
  let currentChannel: Partial<Channel> = {};
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip empty lines and comments (except #EXTINF)
    if (!line || (line.startsWith('#') && !line.startsWith('#EXTINF'))) {
      continue;
    }
    
    // Parse channel info
    if (line.startsWith('#EXTINF')) {
      // Extract attributes from #EXTINF line
      const tvgIdMatch = line.match(/tvg-id="([^"]*)"/);
      const tvgNameMatch = line.match(/tvg-name="([^"]*)"/);
      const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/);
      const groupTitleMatch = line.match(/group-title="([^"]*)"/);
      
      // Extract channel name (after last comma)
      const nameMatch = line.split(',').pop();
      
      currentChannel = {
        id: crypto.randomUUID(),
        tvgId: tvgIdMatch?.[1] || '',
        tvgName: tvgNameMatch?.[1] || '',
        logo: tvgLogoMatch?.[1] || '',
        groupTitle: groupTitleMatch?.[1] || 'Geral',
        name: nameMatch?.trim() || 'Canal sem nome',
        category: groupTitleMatch?.[1] || 'Geral',
      };
      
      categoriesSet.add(currentChannel.category!);
    } 
    // Parse channel URL
    else if (line.startsWith('http')) {
      if (currentChannel.name) {
        channels.push({
          id: currentChannel.id!,
          name: currentChannel.name,
          logo: currentChannel.logo || '',
          url: line,
          category: currentChannel.category!,
          tvgId: currentChannel.tvgId,
          tvgName: currentChannel.tvgName,
          groupTitle: currentChannel.groupTitle,
        });
        currentChannel = {};
      }
    }
  }
  
  return {
    channels,
    categories: Array.from(categoriesSet).sort(),
  };
}

/**
 * Fetch and parse M3U from URL
 */
export async function fetchM3U(url: string): Promise<M3UPlaylist> {
  // Use Edge Function proxy para evitar Mixed Content errors
  const { supabase } = await import('@/integrations/supabase/client');
  
  const { data, error } = await supabase.functions.invoke('fetch-m3u-url', {
    body: { url }
  });

  if (error) {
    throw new Error(`Failed to fetch M3U: ${error.message}`);
  }

  if (!data?.content) {
    throw new Error('No content received from M3U URL');
  }

  return parseM3U(data.content);
}
