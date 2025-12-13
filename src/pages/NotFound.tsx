import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isClient, loading } = useAuth();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    // Wait for auth to finish loading
    if (loading) return;

    // If user is logged in as client, redirect to /app/home
    if (user && isClient) {
      console.log("[NotFound] Client logged in, redirecting to /app/home");
      setRedirecting(true);
      navigate('/app/home', { replace: true });
      return;
    }

    // Check if pathname has encoded query string (e.g., %3F = ?)
    // This happens when URLs are copied/pasted incorrectly
    const pathname = location.pathname;
    
    if (pathname.includes('%3F') || pathname.includes('%3f')) {
      const decoded = decodeURIComponent(pathname);
      const queryIndex = decoded.indexOf('?');
      
      if (queryIndex > -1) {
        const correctPath = decoded.substring(0, queryIndex);
        const queryString = decoded.substring(queryIndex);
        
        console.log(`[NotFound] Fixing encoded URL: ${pathname} -> ${correctPath}${queryString}`);
        setRedirecting(true);
        navigate(`${correctPath}${queryString}`, { replace: true });
        return;
      }
    }
    
    console.error("404 Error: User attempted to access non-existent route:", pathname);
  }, [location.pathname, navigate, user, isClient, loading]);

  if (redirecting || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Redirecionando...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="absolute top-4 left-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Voltar
        </button>
      </div>
      
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold text-foreground">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Página não encontrada</p>
        <a href="/" className="text-primary underline hover:text-primary/80">
          Voltar ao Início
        </a>
      </div>
    </div>
  );
};

export default NotFound;
