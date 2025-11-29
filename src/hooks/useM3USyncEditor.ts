import { useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

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

export function useM3USyncEditor() {
  const [entries, setEntries] = useState<M3UEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClass, setSelectedClass] = useState<ContentClass | "all">("all");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Load ALL entries from a source using pagination
  const loadEntries = useCallback(async (sourceId: string) => {
    setIsLoading(true);
    setSelectedSourceId(sourceId);

    try {
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let page = 0;
      let hasMore = true;

      // Fetch all entries using pagination
      while (hasMore) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const { data, error } = await supabase
          .from("m3u_sync_entries")
          .select("*")
          .eq("source_id", sourceId)
          .eq("is_valid", true)
          .order("group_title")
          .order("title")
          .range(from, to);

        if (error) throw error;

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          hasMore = data.length === PAGE_SIZE;
          page++;

          // Show loading progress
          if (hasMore) {
            toast({
              title: "Carregando...",
              description: `${allData.length.toLocaleString()} entradas carregadas...`,
            });
          }
        } else {
          hasMore = false;
        }
      }

      // Process entries
      const processedEntries: M3UEntry[] = allData.map((entry) => ({
        ...entry,
        content_class: classifyContent(entry.group_title),
        parent_category: extractParentCategory(entry.group_title),
        metadata: entry.metadata as Record<string, any> | null,
      }));

      setEntries(processedEntries);

      toast({
        title: "Conteúdo carregado",
        description: `${processedEntries.length.toLocaleString()} entradas carregadas`,
      });
    } catch (error: any) {
      console.error("[M3USyncEditor] Error loading entries:", error);
      toast({
        title: "Erro",
        description: "Falha ao carregar entradas",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

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
    selectedSourceId,
    searchQuery,
    selectedClass,
    selectedCategory,
    setSearchQuery,
    setSelectedClass,
    setSelectedCategory,
    loadEntries,
    updateEntry,
    bulkUpdateCategory,
    deleteEntry,
    renameCategory,
  };
}
