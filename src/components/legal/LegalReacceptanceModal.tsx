/**
 * Modal de Reaceite de Termos - Exibido quando há nova versão
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLegalAcceptance } from "@/hooks/useLegalAcceptance";

export function LegalReacceptanceModal() {
  const { needsAcceptance, loading, recordAcceptance } = useLegalAcceptance();
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  if (loading || !needsAcceptance) return null;

  async function handleAccept() {
    if (!accepted) {
      toast.error("Você precisa aceitar os termos para continuar.");
      return;
    }
    setSaving(true);
    const success = await recordAcceptance();
    if (success) {
      toast.success("Termos aceitos com sucesso!");
    } else {
      toast.error("Erro ao registrar aceite. Tente novamente.");
    }
    setSaving(false);
  }

  return (
    <Dialog open={needsAcceptance} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Atualização dos Termos
          </DialogTitle>
          <DialogDescription>
            Nossos Termos de Uso e/ou Política de Privacidade foram atualizados. Para continuar utilizando a plataforma, é necessário aceitar a nova versão.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex gap-3 p-3 rounded-lg border bg-muted/30">
            <FileText className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Termos de Uso</p>
              <Link to="/termos" target="_blank" className="text-xs text-primary hover:underline">
                Ler Termos de Uso →
              </Link>
            </div>
          </div>
          <div className="flex gap-3 p-3 rounded-lg border bg-muted/30">
            <Shield className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Política de Privacidade</p>
              <Link to="/privacidade" target="_blank" className="text-xs text-primary hover:underline">
                Ler Política de Privacidade →
              </Link>
            </div>
          </div>

          <div className="flex items-start gap-3 pt-2">
            <Checkbox
              id="legal-accept"
              checked={accepted}
              onCheckedChange={v => setAccepted(v === true)}
            />
            <label htmlFor="legal-accept" className="text-sm text-foreground/80 leading-relaxed cursor-pointer">
              Li e aceito os{" "}
              <Link to="/termos" target="_blank" className="text-primary hover:underline font-medium">
                Termos de Uso
              </Link>{" "}
              e a{" "}
              <Link to="/privacidade" target="_blank" className="text-primary hover:underline font-medium">
                Política de Privacidade
              </Link>
            </label>
          </div>
        </div>

        <Button onClick={handleAccept} disabled={!accepted || saving} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Aceitar e continuar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
