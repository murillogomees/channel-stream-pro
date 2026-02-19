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
  const [clients, setClients] = useState<SigmaClient[]>([]);
  const [total, setTotal] = useState(0);
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
      const { page, pageSize, search, expiration } = filters;
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      // Busca da tabela sigma_blaze_clients (populada pela API do painel Sigma Blaze)
      let query = supabase
        .from("sigma_blaze_clients")
        .select("*", { count: "exact" })
        .eq("status", "active")
        .order("expiration_date", { ascending: true })
        .range(from, to);

      if (search) {
        query = query.or(`name.ilike.%${search}%,whatsapp.ilike.%${search}%,email.ilike.%${search}%`);
      }

      if (expiration !== "all") {
        const now = new Date();
        const twoDays = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

        if (expiration === "red") {
          query = query.lte("expiration_date", twoDays);
        } else if (expiration === "yellow") {
          query = query.gt("expiration_date", twoDays).lte("expiration_date", sevenDays);
        } else if (expiration === "green") {
          query = query.gt("expiration_date", sevenDays);
        }
      }

      const { data, count, error: dbError } = await query;
      if (dbError) throw dbError;

      // Mapear sigma_blaze_clients para SigmaClient interface
      const mapped: SigmaClient[] = (data || []).map((c: any) => ({
        id: c.id,
        username: c.sigma_id || c.id,
        full_name: c.name || "Sem nome",
        phone: c.whatsapp || null,
        package_name: c.plan_name || "Blaze IPTV",
        expiration_date: c.expiration_date,
        status: c.status as SigmaClient["status"],
        email: c.email,
        plan_value: c.plan_value ? Number(c.plan_value) : null,
        last_reminder_sent: c.last_reminder_sent || null,
        notes: c.notes,
      }));

      setClients(mapped);
      setTotal(count || 0);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Polling every 5 min
  useEffect(() => {
    const interval = setInterval(fetchClients, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchClients]);

  const stats = useMemo(() => {
    let green = 0, yellow = 0, red = 0;
    clients.forEach((c) => {
      const color = getExpirationColor(c.expiration_date);
      if (color === "green") green++;
      else if (color === "yellow") yellow++;
      else red++;
    });
    return { green, yellow, red, total };
  }, [clients, total]);

  const totalPages = Math.ceil(total / filters.pageSize);

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
