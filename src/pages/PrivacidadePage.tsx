/**
 * Página de Política de Privacidade
 * SEO otimizado, LGPD/Meta Ads compliant
 */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PrivacidadePage() {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState("");

  useEffect(() => {
    document.title = "Política de Privacidade | Blaze IPTV";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Política de Privacidade da plataforma Blaze IPTV. Saiba como tratamos seus dados pessoais conforme a LGPD.");

    loadDocument();
  }, []);

  async function loadDocument() {
    const { data } = await supabase
      .from("legal_documents")
      .select("content, version")
      .eq("type", "privacy")
      .eq("is_active", true)
      .maybeSingle();

    if (data) {
      setContent(data.content);
      setVersion(data.version);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold text-foreground">Política de Privacidade</h1>
          </div>
          {version && (
            <span className="ml-auto text-xs text-muted-foreground">v{version}</span>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <article className="prose prose-sm sm:prose dark:prose-invert max-w-none 
          prose-headings:text-foreground prose-headings:font-bold prose-headings:mt-8 prose-headings:mb-4
          prose-p:text-foreground/80 prose-p:leading-relaxed
          prose-li:text-foreground/80
          prose-strong:text-foreground
          prose-a:text-primary prose-a:no-underline hover:prose-a:underline">
          {content ? (
            <div dangerouslySetInnerHTML={{ __html: content }} />
          ) : (
            <p className="text-muted-foreground text-center py-12">
              Conteúdo da Política de Privacidade não disponível no momento.
            </p>
          )}
        </article>
      </main>

      <footer className="border-t border-border mt-12">
        <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Blaze IPTV. Todos os direitos reservados.</p>
          <div className="flex gap-4">
            <Link to="/termos" className="hover:text-foreground transition-colors">Termos de Uso</Link>
            <Link to="/" className="hover:text-foreground transition-colors">Página Inicial</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
