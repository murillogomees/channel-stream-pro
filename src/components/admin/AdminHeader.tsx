/**
 * AdminHeader - Header padronizado para todas as páginas admin
 * Inclui: botão voltar, search global, user menu
 * Responsivo: mobile, tablet, desktop, TV
 */

import { Button } from "@/components/ui/button";
import { GlobalSearch } from "./GlobalSearch";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, LogOut, User } from "lucide-react";

interface AdminHeaderProps {
  backTo?: string;
}

export function AdminHeader({ 
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

  return (
    <header className="border-b bg-card sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-card/95">
      <div className="mx-auto w-full max-w-screen-2xl px-3 sm:px-6 md:px-8 2xl:px-10 3xl:px-12 py-3 sm:py-4 2xl:py-5 3xl:py-6">
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(backTo)}
            className="hover:bg-primary/10 flex-shrink-0 h-9 w-9 sm:h-10 sm:w-10 2xl:h-12 2xl:w-12 3xl:h-14 3xl:w-14 focus:ring-2 2xl:focus:ring-4 focus:ring-primary"
            aria-label="Voltar para dashboard"
          >
            <ArrowLeft className="h-4 w-4 2xl:h-5 2xl:w-5 3xl:h-6 3xl:w-6" />
          </Button>

          <div className="flex items-center gap-2 sm:gap-3 2xl:gap-4">
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
