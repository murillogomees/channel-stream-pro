/**
 * AdminHeader - Header padronizado para todas as páginas admin
 * Inclui: botão voltar, título, search global, user menu
 * Responsivo: mobile, tablet, desktop, TV
 */

import { Button } from "@/components/ui/button";
import { GlobalSearch } from "./GlobalSearch";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, LogOut, User } from "lucide-react";

interface AdminHeaderProps {
  title: string;
  description?: string;
  backTo?: string;
}

export function AdminHeader({ 
  title, 
  description,
  backTo = "/admin/dashboard"
}: AdminHeaderProps) {
  const navigate = useNavigate();
  const { signOut: logout, user } = useAuth();
  const { toast } = useToast();

  const handleLogout = async () => {
    await logout();
    toast({
      title: "Logout realizado",
      description: "Você foi desconectado com sucesso.",
    });
    navigate('/login');
  };

  const userName = user?.email?.split('@')[0];
  const displayName = userName 
    ? userName.charAt(0).toUpperCase() + userName.slice(1) 
    : 'Admin';

  return (
    <header className="border-b bg-card sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-card/95">
      <div className="mx-auto w-full max-w-screen-2xl px-3 sm:px-6 md:px-8 2xl:px-10 3xl:px-12 py-3 sm:py-4 2xl:py-5 3xl:py-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 sm:justify-between">
          <div className="flex items-center gap-3 sm:gap-4 2xl:gap-5 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(backTo)}
              className="hover:bg-primary/10 flex-shrink-0 h-9 w-9 sm:h-10 sm:w-10 2xl:h-12 2xl:w-12 3xl:h-14 3xl:w-14 focus:ring-2 2xl:focus:ring-4 focus:ring-primary"
            >
              <ArrowLeft className="h-4 w-4 2xl:h-5 2xl:w-5 3xl:h-6 3xl:w-6" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl 2xl:text-3xl 3xl:text-4xl font-bold truncate">{title}</h1>
              {description && (
                <p className="text-xs sm:text-sm 2xl:text-base 3xl:text-lg text-muted-foreground mt-0.5 sm:mt-1 2xl:mt-2 truncate">
                  {description}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 2xl:gap-4 pl-11 sm:pl-0 overflow-x-auto">
            <GlobalSearch />
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate('/admin/perfil')} 
              className="flex-shrink-0 2xl:h-11 2xl:px-5 2xl:text-base 3xl:h-13 3xl:px-6 3xl:text-lg focus:ring-2 2xl:focus:ring-4"
            >
              <User className="h-4 w-4 2xl:h-5 2xl:w-5 sm:mr-2" />
              <span className="hidden sm:inline">Perfil</span>
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLogout} 
              className="flex-shrink-0 2xl:h-11 2xl:px-5 2xl:text-base 3xl:h-13 3xl:px-6 3xl:text-lg focus:ring-2 2xl:focus:ring-4"
            >
              <LogOut className="h-4 w-4 2xl:h-5 2xl:w-5 sm:mr-2" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

export default AdminHeader;
