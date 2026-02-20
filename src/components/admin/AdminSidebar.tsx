/**
 * AdminSidebar - Sidebar global para navegação do painel admin
 */

import { useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  UserCog,
  Bell,
  BarChart3,
  Shield,
  Settings2,
  Rocket,
  Download,
  LogOut,
  User,
  CreditCard,
  Flame,
  Users,
  MessageCircle,
  TestTube,
} from "lucide-react";

interface NavItem {
  title: string;
  path: string;
  icon: React.ReactNode;
  badge?: string;
}

const mainNav: NavItem[] = [
  { title: "Dashboard", path: "/admin/dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { title: "Usuários", path: "/admin/usuarios", icon: <UserCog className="h-4 w-4" /> },
];

const modulesNav: NavItem[] = [
  { title: "Notificações", path: "/admin/notificacoes", icon: <Bell className="h-4 w-4" /> },
  { title: "Analytics", path: "/admin/analytics", icon: <BarChart3 className="h-4 w-4" /> },
  { title: "Segurança", path: "/admin/seguranca", icon: <Shield className="h-4 w-4" /> },
  { title: "Builds & Deploys", path: "/admin/builds", icon: <Rocket className="h-4 w-4" /> },
  { title: "Sistema", path: "/admin/sistema", icon: <Settings2 className="h-4 w-4" /> },
];

const integracoesNav: NavItem[] = [
  { title: "Mercado Pago", path: "/admin/integracao?tab=mercadopago", icon: <CreditCard className="h-4 w-4" /> },
  { title: "Sigma Blaze", path: "/admin/integracao?tab=sigma", icon: <Flame className="h-4 w-4" /> },
  { title: "Clientes Sigma", path: "/admin/integracao?tab=sigma-clients", icon: <Users className="h-4 w-4" /> },
  { title: "WhatsApp", path: "/admin/integracao?tab=whatsapp", icon: <MessageCircle className="h-4 w-4" /> },
  { title: "QA Dashboard", path: "/admin/integracao?tab=qa", icon: <TestTube className="h-4 w-4" /> },
];

function NavGroup({ label, items }: { label: string; items: NavItem[] }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const isActive = item.path.includes("?")
              ? location.pathname + location.search === item.path
              : location.pathname === item.path;

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  isActive={isActive}
                  onClick={() => navigate(item.path)}
                  tooltip={collapsed ? item.title : undefined}
                >
                  {item.icon}
                  <span>{item.title}</span>
                  {item.badge && !collapsed && (
                    <span className="ml-auto text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                      {item.badge}
                    </span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AdminSidebar() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-3">
        <div className="flex items-center gap-2">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xs">IP</span>
              </div>
              <span className="font-bold text-sm text-sidebar-foreground tracking-tight">
                IPTV Link
              </span>
            </div>
          )}
          {collapsed && (
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center mx-auto">
              <span className="text-primary-foreground font-bold text-xs">IP</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <NavGroup label="Principal" items={mainNav} />
        <SidebarSeparator />
        <NavGroup label="Módulos" items={modulesNav} />
        <SidebarSeparator />
        <NavGroup label="Integrações" items={integracoesNav} />
      </SidebarContent>

      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => navigate("/admin/perfil")} tooltip={collapsed ? "Perfil" : undefined}>
              <User className="h-4 w-4" />
              <span>Perfil</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} tooltip={collapsed ? "Sair" : undefined}>
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
