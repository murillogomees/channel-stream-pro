/**
 * Cookie Consent Banner - LGPD Compliant
 */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Cookie, Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { motion, AnimatePresence } from "framer-motion";

const COOKIE_CONSENT_KEY = "blaze_cookie_consent";

interface CookiePreferences {
  essential: boolean; // always true
  performance: boolean;
  functionality: boolean;
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true,
    performance: false,
    functionality: false,
  });

  useEffect(() => {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!stored) {
      // Show after a short delay
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  function acceptAll() {
    const prefs: CookiePreferences = { essential: true, performance: true, functionality: true };
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(prefs));
    setVisible(false);
  }

  function rejectOptional() {
    const prefs: CookiePreferences = { essential: true, performance: false, functionality: false };
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(prefs));
    setVisible(false);
  }

  function savePreferences() {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(preferences));
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-0 left-0 right-0 z-[100] p-4"
      >
        <div className="max-w-2xl mx-auto bg-card border border-border rounded-2xl shadow-2xl p-6">
          {!showDetails ? (
            <>
              <div className="flex items-start gap-3 mb-4">
                <Cookie className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-foreground text-sm">Utilizamos cookies</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Usamos cookies essenciais para o funcionamento da plataforma e cookies opcionais para melhorar sua experiência.
                    Saiba mais em nossa{" "}
                    <Link to="/privacidade" className="text-primary hover:underline">Política de Privacidade</Link>.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={acceptAll} className="rounded-lg">
                  Aceitar todos
                </Button>
                <Button size="sm" variant="outline" onClick={rejectOptional} className="rounded-lg">
                  Recusar opcionais
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowDetails(true)} className="rounded-lg">
                  <Settings className="h-3.5 w-3.5 mr-1.5" />
                  Gerenciar
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                  <Settings className="h-4 w-4 text-primary" />
                  Preferências de Cookies
                </h3>
                <button onClick={() => setShowDetails(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="text-sm font-medium text-foreground">Essenciais</p>
                    <p className="text-xs text-muted-foreground">Necessários para autenticação e sessão</p>
                  </div>
                  <Switch checked disabled />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="text-sm font-medium text-foreground">Performance</p>
                    <p className="text-xs text-muted-foreground">Análise de uso para melhoria da plataforma</p>
                  </div>
                  <Switch
                    checked={preferences.performance}
                    onCheckedChange={v => setPreferences(p => ({ ...p, performance: v }))}
                  />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="text-sm font-medium text-foreground">Funcionalidade</p>
                    <p className="text-xs text-muted-foreground">Armazenam suas preferências e personalização</p>
                  </div>
                  <Switch
                    checked={preferences.functionality}
                    onCheckedChange={v => setPreferences(p => ({ ...p, functionality: v }))}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={savePreferences} className="rounded-lg">
                  Salvar preferências
                </Button>
                <Button size="sm" variant="outline" onClick={acceptAll} className="rounded-lg">
                  Aceitar todos
                </Button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
