import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Search, Users, Bell, Smartphone, Shield, BarChart3, Settings, User, Palette, FileText } from "lucide-react";

interface SearchItem {
  title: string;
  description: string;
  path: string;
  icon: React.ReactNode;
  category: string;
}

const searchItems: SearchItem[] = [
  // Gestão de Usuários
  {
    title: "Lista de Usuários",
    description: "Visualize e gerencie todos os usuários",
    path: "/admin/usuarios",
    icon: <Users className="h-4 w-4" />,
    category: "Usuários",
  },
  {
    title: "Novo Usuário",
    description: "Cadastre um novo usuário",
    path: "/admin/usuarios?tab=create",
    icon: <User className="h-4 w-4" />,
    category: "Usuários",
  },

  // Notificações
  {
    title: "Configurações de Notificação",
    description: "Configure credenciais WhatsApp",
    path: "/admin/notification-settings",
    icon: <Settings className="h-4 w-4" />,
    category: "Notificações",
  },
  {
    title: "Templates",
    description: "Gerencie templates de mensagens",
    path: "/admin/templates",
    icon: <FileText className="h-4 w-4" />,
    category: "Notificações",
  },
  {
    title: "Notificações Automáticas",
    description: "Configure regras de envio",
    path: "/admin/auto-notifications",
    icon: <Bell className="h-4 w-4" />,
    category: "Notificações",
  },
  {
    title: "Histórico de Notificações",
    description: "Visualize histórico de envios",
    path: "/admin/notificacoes",
    icon: <Bell className="h-4 w-4" />,
    category: "Notificações",
  },
  {
    title: "Estatísticas de Notificações",
    description: "Análise de performance",
    path: "/admin/notification-stats",
    icon: <BarChart3 className="h-4 w-4" />,
    category: "Notificações",
  },

  // M3U / Playlists
  {
    title: "Saúde das Playlists",
    description: "Monitore URLs M3U",
    path: "/admin/playlist-health",
    icon: <BarChart3 className="h-4 w-4" />,
    category: "Playlists",
  },
  {
    title: "Integrações",
    description: "WhatsApp",
    path: "/admin/integrations",
    icon: <Smartphone className="h-4 w-4" />,
    category: "Playlists",
  },

  // Segurança
  {
    title: "Monitor de Segurança",
    description: "Eventos em tempo real",
    path: "/admin/security-monitor",
    icon: <Shield className="h-4 w-4" />,
    category: "Segurança",
  },
  {
    title: "Analytics de Segurança",
    description: "Análise de ameaças",
    path: "/admin/security-analytics",
    icon: <BarChart3 className="h-4 w-4" />,
    category: "Segurança",
  },
  {
    title: "Bloqueio de IPs",
    description: "Gerencie IPs bloqueados",
    path: "/admin/ip-blocking",
    icon: <Shield className="h-4 w-4" />,
    category: "Segurança",
  },

  // Sistema
  {
    title: "Analytics",
    description: "Métricas do sistema",
    path: "/admin/analytics",
    icon: <BarChart3 className="h-4 w-4" />,
    category: "Sistema",
  },
  {
    title: "Saúde do Sistema",
    description: "Status de serviços",
    path: "/admin/system-health",
    icon: <BarChart3 className="h-4 w-4" />,
    category: "Sistema",
  },
  {
    title: "Personalização",
    description: "Customize cores e aparência",
    path: "/admin/customize",
    icon: <Palette className="h-4 w-4" />,
    category: "Sistema",
  },
];

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const groupedItems = searchItems.reduce(
    (acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    },
    {} as Record<string, SearchItem[]>,
  );

  return (
    <>
      <Button
        variant="outline"
        className="relative w-full justify-start text-sm text-muted-foreground sm:pr-12 md:w-40 lg:w-64"
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 h-4 w-4" />
        <span className="hidden lg:inline-flex">Buscar...</span>
        <span className="inline-flex lg:hidden">Buscar</span>
        <kbd className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘K</span>
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Digite para buscar..." />
        <CommandList>
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
          {Object.entries(groupedItems).map(([category, items]) => (
            <CommandGroup key={category} heading={category}>
              {items.map((item) => (
                <CommandItem
                  key={item.path}
                  value={`${item.title} ${item.description}`}
                  onSelect={() => handleSelect(item.path)}
                >
                  <div className="flex items-center gap-3 w-full">
                    <div className="p-1.5 rounded bg-primary/10 text-primary">{item.icon}</div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
