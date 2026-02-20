import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays } from "date-fns";

export interface SigmaClient {
  id: string;
  username: string;
  full_name: string;
  phone: string | null;
  package_name: string;
  expiration_date: string;
  status: "active" | "expired" | "suspended";
  email?: string | null;
  plan_value?: number | null;
  last_reminder_sent?: string | null;
  notes?: string | null;
}

export type ExpirationColor = "green" | "yellow" | "red";

export interface SigmaFilters {
  search: string;
  expiration: "all" | ExpirationColor;
  page: number;
  pageSize: number;
}

export function getExpirationColor(expirationDate: string): ExpirationColor {
  const daysLeft = differenceInDays(new Date(expirationDate), new Date());
  if (daysLeft <= 2) return "red";
  if (daysLeft <= 7) return "yellow";
  return "green";
}

export function getExpirationLabel(color: ExpirationColor): string {
  switch (color) {
    case "green": return "Plano ativo";
    case "yellow": return "Plano próximo do vencimento";
    case "red": return "Plano vencendo";
  }
}

export function getDaysLeft(expirationDate: string): number {
  return Math.max(0, differenceInDays(new Date(expirationDate), new Date()));
}

export function useSigmaClients() {
  const [allClients, setAllClients] = useState<SigmaClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<SigmaFilters>({
    search: "",
    expiration: "all",
    page: 1,
    pageSize: 20,
  });

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Busca paginada de todos os clientes via action list_customers
      const allCustomers: any[] = [];
      let page = 1;
      const perPage = 100;
      let hasMore = true;

      while (hasMore && page <= 10) {
        try {
          const { data, error: fnError } = await supabase.functions.invoke("sigma-blaze-client", {
            body: { action: "list_customers", page, perPage },
          });

          if (fnError) {
            console.warn(`[SigmaClients] Error on page ${page}, using partial data:`, fnError);
            break; // Use dados parciais já carregados
          }

          const customers = data?.data || [];
          if (customers.length === 0) break;
          allCustomers.push(...customers);

          const lastPage = data?.meta?.last_page || data?.meta?.lastPage || 1;
          hasMore = page < lastPage;
          page++;
        } catch (pageErr) {
          console.warn(`[SigmaClients] Page ${page} failed, using ${allCustomers.length} partial results`);
          break; // Use dados parciais
        }
      }

      // Filtrar apenas clientes do provedor "Blaze IPTV" (excluir MaxPlayer)
      const blazeOnly = allCustomers.filter((c: any) => {
        const pkg = (c.package || c.plan_name || c.package_name || c.plano || c.plan || "").toLowerCase();
        // Excluir clientes MaxPlayer (mesmos critérios do sigma-cleanup-maxplayer)
        if (pkg.includes("maxplayer") || pkg.includes("max player") || pkg.includes("max_player")) return false;
        return true;
      });

      // Mapear para SigmaClient interface
      const mapped: SigmaClient[] = blazeOnly.map((c: any, idx: number) => ({
        id: String(c.id || c.client_id || c.user_id || idx),
        username: c.username || c.login || c.user || c.nome_usuario || String(c.id || idx),
        full_name: c.name || c.username || c.nome || c.full_name || "Sem nome",
        phone: c.whatsapp || c.phone || c.telefone || c.cel || null,
        package_name: c.package || c.plan_name || c.package_name || c.plano || c.plan || "Blaze IPTV",
        expiration_date: c.expires_at || c.expiration_date || c.exp_date || c.data_expiracao || c.due_date || new Date().toISOString(),
        status: (c.status === "EXPIRED" || c.status === "inactive" || c.status === "disabled" || c.status === "blocked") ? "expired" as const : "active" as const,
        email: c.email || c.e_mail || null,
        plan_value: parseFloat(c.plan_price || c.plan_value || c.package_value || c.valor || c.price || "0") || null,
        last_reminder_sent: null,
        notes: c.note || c.notes || c.obs || c.observacao || null,
      }));

      setAllClients(mapped);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Filtragem client-side (dados já vêm todos da API)
  const filteredClients = useMemo(() => {
    let result = allClients;

    // Filtro de busca
    if (filters.search) {
      const s = filters.search.toLowerCase();
      result = result.filter((c) =>
        c.full_name.toLowerCase().includes(s) ||
        c.username.toLowerCase().includes(s) ||
        (c.phone && c.phone.includes(s)) ||
        (c.email && c.email.toLowerCase().includes(s))
      );
    }

    // Filtro de vencimento
    if (filters.expiration !== "all") {
      result = result.filter((c) => getExpirationColor(c.expiration_date) === filters.expiration);
    }

    // Ordenar por data de vencimento
    result.sort((a, b) => new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime());

    return result;
  }, [allClients, filters.search, filters.expiration]);

  const total = filteredClients.length;
  const totalPages = Math.ceil(total / filters.pageSize);

  // Paginação client-side
  const clients = useMemo(() => {
    const from = (filters.page - 1) * filters.pageSize;
    return filteredClients.slice(from, from + filters.pageSize);
  }, [filteredClients, filters.page, filters.pageSize]);

  const stats = useMemo(() => {
    let green = 0, yellow = 0, red = 0;
    allClients.forEach((c) => {
      const color = getExpirationColor(c.expiration_date);
      if (color === "green") green++;
      else if (color === "yellow") yellow++;
      else red++;
    });
    return { green, yellow, red, total: allClients.length };
  }, [allClients]);

  return {
    clients,
    loading,
    error,
    filters,
    setFilters,
    stats,
    total,
    totalPages,
    refresh: fetchClients,
  };
}
