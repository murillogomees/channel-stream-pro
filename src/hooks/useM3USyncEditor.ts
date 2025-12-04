import { useState, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { getCachedEntries, setCachedEntries, clearCache, getCacheMeta } from "./useM3UCache";

export type ContentClass = "tv" | "movies" | "series" | "other";

export interface M3UEntry {
  id: string;
  source_id: string;
  title: string;
  stream_url: string;
  group_title: string | null;
  tvg_id: string | null;
  tvg_name: string | null;
  tvg_logo: string | null;
  tvg_language: string | null;
  duration: number | null;
  is_valid: boolean;
  metadata: Record<string, any> | null;
  // Computed
  content_class: ContentClass;
  parent_category: string;
}

export interface CategoryGroup {
  name: string;
  displayName: string;
  entries: M3UEntry[];
  contentClass: ContentClass;
}

export interface ClassGroup {
  class: ContentClass;
  label: string;
  categories: CategoryGroup[];
  totalEntries: number;
}

export interface LoadingProgress {
  loaded: number;
  total: number;
  percent: number;
  phase: 'counting' | 'fetching' | 'processing' | 'done';
  fromCache?: boolean;
}

// Classify content based on group_title patterns
function classifyContent(groupTitle: string | null): ContentClass {
  if (!groupTitle) return "other";

  const lower = groupTitle.toLowerCase();

  // Series patterns
  if (
    lower.includes("séries") ||
    lower.includes("series") ||
    lower.includes("temporada") ||
    lower.includes("season") ||
    lower.includes("novelas") ||
    lower.includes("doramas") ||
    lower.includes("animes") ||
    lower.includes("reality") ||
    lower.includes("tokusatsu")
  ) {
    return "series";
  }

  // Movies patterns
  if (
    lower.includes("filme") ||
    lower.includes("filmes") ||
    lower.includes("movie") ||
    lower.includes("cinema") ||
    lower.includes("lançamento")
  ) {
    return "movies";
  }

  // TV/Live patterns
  if (
    lower.includes("canais") ||
    lower.includes("tv") ||
    lower.includes("ao vivo") ||
    lower.includes("live") ||
    lower.includes("24h") ||
    lower.includes("globo") ||
    lower.includes("pluto") ||
    lower.includes("karaoke") ||
    lower.includes("docs")
  ) {
    return "tv";
  }

  return "other";
}

// Extract parent category from group_title
function extractParentCategory(groupTitle: string | null): string {
  if (!groupTitle) return "Sem Categoria";

  // Handle patterns like "SÉRIES: NETFLIX" -> "SÉRIES"
  // or "FILMES: DRAMA" -> "FILMES"
  const parts = groupTitle.split(":");
  if (parts.length > 1) {
    return parts[0].trim();
  }

  return groupTitle;
}

const CLASS_LABELS: Record<ContentClass, string> = {
  tv: "TV ao Vivo",
  movies: "Filmes",
  series: "Séries",
  other: "Outros",
};

// Prefixes to force content into a specific class
const CLASS_PREFIXES: Record<ContentClass, string> = {
  tv: "CANAIS:",
  movies: "FILMES:",
  series: "SÉRIES:",
  other: "OUTROS:",
};

export { CLASS_LABELS, CLASS_PREFIXES };

// Process raw entries into M3UEntry format
function processEntries(rawEntries: any[]): M3UEntry[] {
  return rawEntries.map((entry) => ({
    ...entry,
    content_class: classifyContent(entry.group_title),
    parent_category: extractParentCategory(entry.group_title),
    metadata: entry.metadata as Record<string, any> | null,
  }));
}

export function useM3USyncEditor() {
  const [entries, setEntries] = useState<M3UEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress>({
    loaded: 0,
    total: 0,
    percent: 0,
    phase: 'done',
  });
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClass, setSelectedClass] = useState<ContentClass | "all">("all");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  // Abort controller for cancelling ongoing loads
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load ALL entries from a source using optimized parallel pagination with progressive loading
  const loadEntries = useCallback(async (sourceId: string, forceRefresh = false) => {
    // Cancel any ongoing load
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsLoading(true);
    setSelectedSourceId(sourceId);
    setEntries([]); // Clear previous entries
    setLoadingProgress({ loaded: 0, total: 0, percent: 0, phase: 'counting' });

    try {
      // Check cache first (unless force refresh)
      if (!forceRefresh) {
        const cachedData = await getCachedEntries(sourceId);
        if (cachedData && cachedData.length > 0) {
          const cacheMeta = await getCacheMeta(sourceId);
          const cacheAge = cacheMeta ? Math.round((Date.now() - cacheMeta.timestamp) / 60000) : 0;
          
          console.log(`[M3USyncEditor] Using cache: ${cachedData.length} entries (${cacheAge}min old)`);
          
          setLoadingProgress({ 
            loaded: cachedData.length, 
            total: cachedData.length, 
            percent: 100, 
            phase: 'done',
            fromCache: true 
          });
          setEntries(processEntries(cachedData));
          setIsLoading(false);
          
          toast({
            title: "Cache carregado",
            description: `${cachedData.length.toLocaleString()} entradas (cache de ${cacheAge}min)`,
          });
          return;
        }
      }

      // Supabase has a default limit of 1000 rows per request
      // Use smaller pages with more parallelism to work within this limit
      const PAGE_SIZE = 1000; // Match Supabase default limit
      const PARALLEL_REQUESTS = 8; // More parallel requests to compensate
      const MAX_RETRIES = 3;
      const BATCH_DELAY_MS = 100; // Small delay between batches to avoid rate limits

      console.log(`[M3USyncEditor] Starting load for source: ${sourceId}`);

      // First, get total count
      const { count, error: countError } = await supabase
        .from("m3u_sync_entries")
        .select("*", { count: "exact", head: true })
        .eq("source_id", sourceId)
        .eq("is_valid", true);

      if (signal.aborted) return;
      if (countError) throw countError;

      const totalCount = count || 0;
      console.log(`[M3USyncEditor] Total count: ${totalCount}`);
      
      if (totalCount === 0) {
        setEntries([]);
        setLoadingProgress({ loaded: 0, total: 0, percent: 100, phase: 'done' });
        toast({
          title: "Sem entradas",
          description: "Esta fonte não possui entradas válidas",
        });
        setIsLoading(false);
        return;
      }

      setLoadingProgress({ loaded: 0, total: totalCount, percent: 0, phase: 'fetching' });

      // Calculate total pages
      const totalPages = Math.ceil(totalCount / PAGE_SIZE);
      let loadedEntries: any[] = [];
      
      console.log(`[M3USyncEditor] Loading ${totalPages} pages of ${PAGE_SIZE} entries each`);

      // Helper function to fetch a single page with retry using offset/limit
      const fetchPage = async (page: number, retryCount = 0): Promise<any[]> => {
        if (signal.aborted) return [];
        
        const offset = page * PAGE_SIZE;

        try {
          // Use offset/limit instead of range for more reliable pagination
          const { data, error } = await supabase
            .from("m3u_sync_entries")
            .select("id,source_id,title,stream_url,group_title,tvg_id,tvg_name,tvg_logo,tvg_language,duration,is_valid,metadata")
            .eq("source_id", sourceId)
            .eq("is_valid", true)
            .order("group_title", { ascending: true })
            .order("title", { ascending: true })
            .range(offset, offset + PAGE_SIZE - 1);

          if (error) {
            console.warn(`[M3USyncEditor] Page ${page} error (attempt ${retryCount + 1}):`, error.message);
            if (retryCount < MAX_RETRIES) {
              await new Promise(r => setTimeout(r, 500 * (retryCount + 1)));
              return fetchPage(page, retryCount + 1);
            }
            console.error(`[M3USyncEditor] Page ${page} failed after ${MAX_RETRIES} retries`);
            return [];
          }
          
          return data || [];
        } catch (e: any) {
          console.warn(`[M3USyncEditor] Page ${page} exception (attempt ${retryCount + 1}):`, e.message);
          if (retryCount < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, 500 * (retryCount + 1)));
            return fetchPage(page, retryCount + 1);
          }
          console.error(`[M3USyncEditor] Page ${page} exception after ${MAX_RETRIES} retries`);
          return [];
        }
      };

      // Progressive loading - fetch and display as data comes in
      let lastProgressLog = 0;
      for (let i = 0; i < totalPages; i += PARALLEL_REQUESTS) {
        if (signal.aborted) return;
        
        const batch = Array.from(
          { length: Math.min(PARALLEL_REQUESTS, totalPages - i) },
          (_, idx) => i + idx
        );
        
        const results = await Promise.all(batch.map(page => fetchPage(page)));
        const batchData = results.flat();
        
        // Check if we actually got data
        if (batchData.length === 0 && i < totalPages - 1) {
          console.warn(`[M3USyncEditor] Empty batch at page ${i}, retrying...`);
          // Wait and retry this batch once
          await new Promise(r => setTimeout(r, 1000));
          const retryResults = await Promise.all(batch.map(page => fetchPage(page)));
          const retryData = retryResults.flat();
          if (retryData.length > 0) {
            loadedEntries = [...loadedEntries, ...retryData];
          }
        } else {
          loadedEntries = [...loadedEntries, ...batchData];
        }

        // Progressive update - show entries as they load (every 10% or 20k entries)
        const currentPercent = Math.round((loadedEntries.length / totalCount) * 100);
        if (currentPercent >= lastProgressLog + 5 || loadedEntries.length - lastProgressLog * (totalCount/100) >= 20000) {
          const processedSoFar = processEntries(loadedEntries);
          setEntries(processedSoFar);
          lastProgressLog = currentPercent;
        }

        // Update progress
        setLoadingProgress({
          loaded: loadedEntries.length,
          total: totalCount,
          percent: currentPercent,
          phase: 'fetching',
        });

        // Log progress every 10%
        if (currentPercent % 10 === 0 || i === 0) {
          console.log(`[M3USyncEditor] Progress: ${loadedEntries.length.toLocaleString()}/${totalCount.toLocaleString()} (${currentPercent}%)`);
        }
        
        // Small delay between batches to avoid rate limits
        if (i + PARALLEL_REQUESTS < totalPages) {
          await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
        }
      }
      
      // Final update with all entries
      setEntries(processEntries(loadedEntries));

      if (signal.aborted) return;

      // Cache the loaded entries
      await setCachedEntries(sourceId, loadedEntries);

      setLoadingProgress({ 
        loaded: loadedEntries.length, 
        total: loadedEntries.length, 
        percent: 100, 
        phase: 'done' 
      });

      toast({
        title: "Conteúdo carregado",
        description: `${loadedEntries.length.toLocaleString()} entradas carregadas e em cache`,
      });
    } catch (error: any) {
      if (signal.aborted) return;
      console.error("[M3USyncEditor] Error loading entries:", error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao carregar entradas",
        variant: "destructive",
      });
      setLoadingProgress({ loaded: 0, total: 0, percent: 0, phase: 'done' });
    } finally {
      if (!signal.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  // Force refresh (bypass cache)
  const forceRefresh = useCallback(async () => {
    if (selectedSourceId) {
      await clearCache(selectedSourceId);
      await loadEntries(selectedSourceId, true);
    }
  }, [selectedSourceId, loadEntries]);

  // Group entries by class and category
  const groupedData = useMemo((): ClassGroup[] => {
    const classMap: Record<ContentClass, Map<string, M3UEntry[]>> = {
      tv: new Map(),
      movies: new Map(),
      series: new Map(),
      other: new Map(),
    };

    // Filter by search and selected filters
    let filtered = entries;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) => e.title.toLowerCase().includes(query) || e.group_title?.toLowerCase().includes(query),
      );
    }

    if (selectedClass !== "all") {
      filtered = filtered.filter((e) => e.content_class === selectedClass);
    }

    if (selectedCategory) {
      filtered = filtered.filter((e) => e.group_title === selectedCategory);
    }

    // Group
    filtered.forEach((entry) => {
      const category = entry.group_title || "Sem Categoria";
      const classEntries = classMap[entry.content_class];

      if (!classEntries.has(category)) {
        classEntries.set(category, []);
      }
      classEntries.get(category)!.push(entry);
    });

    // Convert to array
    return (["tv", "movies", "series", "other"] as ContentClass[])
      .map((cls) => {
        const categories: CategoryGroup[] = [];
        let totalEntries = 0;

        classMap[cls].forEach((entries, name) => {
          categories.push({
            name,
            displayName: name,
            entries,
            contentClass: cls,
          });
          totalEntries += entries.length;
        });

        // Sort categories by entry count
        categories.sort((a, b) => b.entries.length - a.entries.length);

        return {
          class: cls,
          label: CLASS_LABELS[cls],
          categories,
          totalEntries,
        };
      })
      .filter((g) => g.totalEntries > 0);
  }, [entries, searchQuery, selectedClass, selectedCategory]);

  // Get all unique categories
  const allCategories = useMemo(() => {
    const cats = new Map<string, { count: number; class: ContentClass }>();

    entries.forEach((entry) => {
      const cat = entry.group_title || "Sem Categoria";
      if (!cats.has(cat)) {
        cats.set(cat, { count: 0, class: entry.content_class });
      }
      cats.get(cat)!.count++;
    });

    return Array.from(cats.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [entries]);

  // Update entry
  const updateEntry = useCallback(
    async (
      entryId: string,
      updates: Partial<Pick<M3UEntry, "title" | "group_title" | "tvg_name" | "tvg_logo" | "tvg_id">>,
    ): Promise<boolean> => {
      try {
        const { error } = await supabase
          .from("m3u_sync_entries")
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq("id", entryId);

        if (error) throw error;

        // Update local state
        setEntries((prev) =>
          prev.map((e) => {
            if (e.id === entryId) {
              const updated = { ...e, ...updates };
              return {
                ...updated,
                content_class: classifyContent(updated.group_title),
                parent_category: extractParentCategory(updated.group_title),
              };
            }
            return e;
          }),
        );

        toast({ title: "Entrada atualizada" });
        return true;
      } catch (error: any) {
        console.error("[M3USyncEditor] Error updating entry:", error);
        toast({
          title: "Erro",
          description: "Falha ao atualizar entrada",
          variant: "destructive",
        });
        return false;
      }
    },
    [],
  );

  // Bulk update category
  const bulkUpdateCategory = useCallback(async (entryIds: string[], newCategory: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("m3u_sync_entries")
        .update({
          group_title: newCategory,
          updated_at: new Date().toISOString(),
        })
        .in("id", entryIds);

      if (error) throw error;

      // Update local state
      setEntries((prev) =>
        prev.map((e) => {
          if (entryIds.includes(e.id)) {
            return {
              ...e,
              group_title: newCategory,
              content_class: classifyContent(newCategory),
              parent_category: extractParentCategory(newCategory),
            };
          }
          return e;
        }),
      );

      toast({
        title: "Categoria atualizada",
        description: `${entryIds.length} entradas movidas para "${newCategory}"`,
      });
      return true;
    } catch (error: any) {
      console.error("[M3USyncEditor] Error bulk updating:", error);
      toast({
        title: "Erro",
        description: "Falha ao atualizar categoria em lote",
        variant: "destructive",
      });
      return false;
    }
  }, []);

  // Delete entry
  const deleteEntry = useCallback(async (entryId: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from("m3u_sync_entries").delete().eq("id", entryId);

      if (error) throw error;

      setEntries((prev) => prev.filter((e) => e.id !== entryId));
      toast({ title: "Entrada removida" });
      return true;
    } catch (error: any) {
      console.error("[M3USyncEditor] Error deleting entry:", error);
      toast({
        title: "Erro",
        description: "Falha ao remover entrada",
        variant: "destructive",
      });
      return false;
    }
  }, []);

  // Rename category (update all entries with this category)
  const renameCategory = useCallback(
    async (oldName: string, newName: string): Promise<boolean> => {
      if (!selectedSourceId) return false;

      try {
        const { error } = await supabase
          .from("m3u_sync_entries")
          .update({
            group_title: newName,
            updated_at: new Date().toISOString(),
          })
          .eq("source_id", selectedSourceId)
          .eq("group_title", oldName);

        if (error) throw error;

        // Update local state
        setEntries((prev) =>
          prev.map((e) => {
            if (e.group_title === oldName) {
              return {
                ...e,
                group_title: newName,
                content_class: classifyContent(newName),
                parent_category: extractParentCategory(newName),
              };
            }
            return e;
          }),
        );

        toast({
          title: "Categoria renomeada",
          description: `"${oldName}" → "${newName}"`,
        });
        return true;
      } catch (error: any) {
        console.error("[M3USyncEditor] Error renaming category:", error);
        toast({
          title: "Erro",
          description: "Falha ao renomear categoria",
          variant: "destructive",
        });
        return false;
      }
    },
    [selectedSourceId],
  );

  // Move category to a different content class
  const moveCategoryToClass = useCallback(
    async (categoryName: string, targetClass: ContentClass): Promise<boolean> => {
      if (!selectedSourceId) return false;

      try {
        // Get entries in this category
        const categoryEntries = entries.filter((e) => e.group_title === categoryName);
        if (categoryEntries.length === 0) return false;

        // Create new category name with target class prefix
        const prefix = CLASS_PREFIXES[targetClass];

        // Remove existing class prefix if present
        let baseName = categoryName;
        for (const p of Object.values(CLASS_PREFIXES)) {
          if (categoryName.toUpperCase().startsWith(p)) {
            baseName = categoryName.slice(p.length).trim();
            break;
          }
        }

        // If baseName contains ":", take the part after it
        if (baseName.includes(":")) {
          baseName = baseName.split(":").slice(1).join(":").trim();
        }

        const newCategoryName = `${prefix} ${baseName}`;

        const { error } = await supabase
          .from("m3u_sync_entries")
          .update({
            group_title: newCategoryName,
            updated_at: new Date().toISOString(),
          })
          .eq("source_id", selectedSourceId)
          .eq("group_title", categoryName);

        if (error) throw error;

        // Update local state
        setEntries((prev) =>
          prev.map((e) => {
            if (e.group_title === categoryName) {
              return {
                ...e,
                group_title: newCategoryName,
                content_class: targetClass,
                parent_category: extractParentCategory(newCategoryName),
              };
            }
            return e;
          }),
        );

        toast({
          title: "Categoria movida",
          description: `"${categoryName}" → "${newCategoryName}" (${CLASS_LABELS[targetClass]})`,
        });
        return true;
      } catch (error: any) {
        console.error("[M3USyncEditor] Error moving category to class:", error);
        toast({
          title: "Erro",
          description: "Falha ao mover categoria",
          variant: "destructive",
        });
        return false;
      }
    },
    [selectedSourceId, entries],
  );

  // Get filtered entries based on current filters
  const filteredEntries = useMemo(() => {
    let filtered = entries;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) => e.title.toLowerCase().includes(query) || e.group_title?.toLowerCase().includes(query),
      );
    }
    
    if (selectedClass !== "all") {
      filtered = filtered.filter((e) => e.content_class === selectedClass);
    }
    
    if (selectedCategory) {
      filtered = filtered.filter((e) => e.group_title === selectedCategory);
    }
    
    return filtered;
  }, [entries, searchQuery, selectedClass, selectedCategory]);

  // Generate M3U content from filtered entries
  const generateM3UContent = useCallback((): string => {
    let m3uContent = '#EXTM3U\n\n';
    
    // Sort entries by group_title and then by title
    const sortedEntries = [...filteredEntries].sort((a, b) => {
      const groupCompare = (a.group_title || '').localeCompare(b.group_title || '');
      if (groupCompare !== 0) return groupCompare;
      return a.title.localeCompare(b.title);
    });

    for (const entry of sortedEntries) {
      const tvgId = entry.tvg_id ? ` tvg-id="${entry.tvg_id}"` : '';
      const tvgName = entry.tvg_name ? ` tvg-name="${entry.tvg_name}"` : '';
      const tvgLogo = entry.tvg_logo ? ` tvg-logo="${entry.tvg_logo}"` : '';
      const groupTitle = entry.group_title ? ` group-title="${entry.group_title}"` : '';

      m3uContent += `#EXTINF:-1${tvgId}${tvgName}${tvgLogo}${groupTitle},${entry.title}\n`;
      m3uContent += `${entry.stream_url}\n\n`;
    }

    return m3uContent;
  }, [filteredEntries]);

  // Generate M3U and upload to CDN (server-side generation with filters)
  const generateM3UCDN = useCallback(async (): Promise<{ success: boolean; cdnUrl?: string; error?: string }> => {
    if (!selectedSourceId) {
      return { success: false, error: 'Nenhuma fonte selecionada' };
    }

    // If we have filters applied, get entry IDs to send to server
    const hasFilters = searchQuery || selectedClass !== 'all' || selectedCategory;
    const entryIds = hasFilters ? filteredEntries.map(e => e.id) : null;

    if (hasFilters && filteredEntries.length === 0) {
      return { success: false, error: 'Nenhuma entrada para gerar (verifique os filtros)' };
    }

    try {
      // Get source info for slug
      const { data: source } = await supabase
        .from('m3u_sync_sources')
        .select('key, name')
        .eq('id', selectedSourceId)
        .single();

      if (!source) {
        return { success: false, error: 'Fonte não encontrada' };
      }

      const entriesCount = hasFilters ? filteredEntries.length : entries.length;
      toast({
        title: 'Gerando M3U CDN...',
        description: `Processando ${entriesCount.toLocaleString()} entradas${hasFilters ? ' (filtradas)' : ''}...`,
      });

      // Call edge function with filters
      const { data, error } = await supabase.functions.invoke('generate-m3u-from-sync', {
        body: {
          sourceId: selectedSourceId,
          sourceKey: source.key,
          sourceName: source.name,
          // Send entry IDs if filters are applied (for smaller sets)
          entryIds: entryIds && entryIds.length <= 50000 ? entryIds : null,
          // Send filter params for server-side filtering
          filters: hasFilters ? {
            searchQuery,
            selectedClass: selectedClass !== 'all' ? selectedClass : null,
            selectedCategory,
          } : null,
        }
      });

      if (error) throw error;

      toast({
        title: 'M3U CDN gerada com sucesso',
        description: `${data?.entriesCount?.toLocaleString() || '?'} entradas • ${((data?.fileSize || 0) / 1024 / 1024).toFixed(2)} MB`,
      });

      return { success: true, cdnUrl: data?.cdnUrl };
    } catch (error: any) {
      console.error('[M3USyncEditor] Error generating M3U CDN:', error);
      toast({
        title: 'Erro ao gerar M3U CDN',
        description: error.message || 'Falha no upload',
        variant: 'destructive',
      });
      return { success: false, error: error.message };
    }
  }, [selectedSourceId, filteredEntries, entries.length, searchQuery, selectedClass, selectedCategory]);

  // Statistics
  const stats = useMemo(
    () => ({
      total: entries.length,
      tv: entries.filter((e) => e.content_class === "tv").length,
      movies: entries.filter((e) => e.content_class === "movies").length,
      series: entries.filter((e) => e.content_class === "series").length,
      other: entries.filter((e) => e.content_class === "other").length,
      categories: allCategories.length,
    }),
    [entries, allCategories],
  );

  return {
    entries,
    groupedData,
    allCategories,
    stats,
    isLoading,
    loadingProgress,
    selectedSourceId,
    searchQuery,
    selectedClass,
    selectedCategory,
    setSearchQuery,
    setSelectedClass,
    setSelectedCategory,
    loadEntries,
    forceRefresh,
    updateEntry,
    bulkUpdateCategory,
    deleteEntry,
    renameCategory,
    moveCategoryToClass,
    generateM3UContent,
    generateM3UCDN,
  };
}
