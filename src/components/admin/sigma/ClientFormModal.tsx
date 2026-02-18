import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import type { SigmaClient } from "@/services/sigmaBlaze/sigmaClientsService";

interface ClientFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: SigmaClient | null;
  onSave: (data: Partial<SigmaClient>) => Promise<void>;
}

export function ClientFormModal({ open, onOpenChange, client, onSave }: ClientFormModalProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    whatsapp: "",
    email: "",
    plan_name: "Blaze IPTV",
    expiration_date: "",
    notes: "",
  });

  useEffect(() => {
    if (client) {
      setForm({
        name: client.name,
        whatsapp: client.whatsapp,
        email: client.email || "",
        plan_name: client.plan_name,
        expiration_date: client.expiration_date ? new Date(client.expiration_date).toISOString().slice(0, 16) : "",
        notes: client.notes || "",
      });
    } else {
      setForm({ name: "", whatsapp: "", email: "", plan_name: "Blaze IPTV", expiration_date: "", notes: "" });
    }
  }, [client, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ ...form, expiration_date: new Date(form.expiration_date).toISOString() });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{client ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>WhatsApp *</Label>
              <Input value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} placeholder="5511999999999" required />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} type="email" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Plano</Label>
              <Input value={form.plan_name} onChange={e => setForm(f => ({ ...f, plan_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Vencimento *</Label>
              <Input type="datetime-local" value={form.expiration_date} onChange={e => setForm(f => ({ ...f, expiration_date: e.target.value }))} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {client ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
