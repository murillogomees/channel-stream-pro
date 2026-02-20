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

function isMaxPlayer(pkg: string): boolean {
  const lower = pkg.toLowerCase();
  return lower.includes("maxplayer") || lower.includes("max player") || lower.includes("max_player");
}

function mapCustomerToClient(c: any, idx: number): SigmaClient {
  return {
    id: String(c.sigma_id || c.id || c.client_id || c.user_id || idx),
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
  };
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
      // Uma única chamada que busca todos os clientes (com cache no DB)
      const { data, error: fnError } = await supabase.functions.invoke("sigma-blaze-client", {
        body: { action: "list_all_customers" },
      });

      if (fnError) {
        throw new Error(fnError.message || "Erro ao buscar clientes");
      }

      const customers = data?.data || [];

      // Filtrar apenas Blaze IPTV (excluir MaxPlayer pelo pacote ou servidor)
      const blazeOnly = customers.filter((c: any) => {
        const pkg = (c.package || c.plan_name || c.package_name || c.plano || c.plan || "").toLowerCase();
        const server = (c.server || "").toLowerCase();
        if (isMaxPlayer(pkg) || isMaxPlayer(server)) return false;
        return true;
      });

      const mapped: SigmaClient[] = blazeOnly.map(mapCustomerToClient);
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

  // Filtragem client-side
  const filteredClients = useMemo(() => {
    let result = allClients;

    if (filters.search) {
      const s = filters.search.toLowerCase();
      result = result.filter((c) =>
        c.full_name.toLowerCase().includes(s) ||
        c.username.toLowerCase().includes(s) ||
        (c.phone && c.phone.includes(s)) ||
        (c.email && c.email.toLowerCase().includes(s))
      );
    }

    if (filters.expiration !== "all") {
      result = result.filter((c) => getExpirationColor(c.expiration_date) === filters.expiration);
    }

    result.sort((a, b) => new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime());

    return result;
  }, [allClients, filters.search, filters.expiration]);

  const total = filteredClients.length;
  const totalPages = Math.ceil(total / filters.pageSize);

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
