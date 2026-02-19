import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Send, Eye, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { SigmaClient } from "@/hooks/useSigmaClients";
import { getDaysLeft } from "@/hooks/useSigmaClients";

interface WhatsAppReminderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: SigmaClient[];
  onSent: () => void;
}

interface ReminderTemplate {
  id: string;
  name: string;
  message: string;
  is_default: boolean;
}

function processMessage(message: string, client: SigmaClient): string {
  const daysLeft = getDaysLeft(client.expiration_date);
  const formattedDate = format(new Date(client.expiration_date), "dd/MM/yyyy", { locale: ptBR });
  return message
    .replace(/\{\{nome\}\}/g, client.full_name)
    .replace(/\{\{data_vencimento\}\}/g, formattedDate)
    .replace(/\{\{dias_restantes\}\}/g, String(daysLeft));
}

export function WhatsAppReminderModal({ open, onOpenChange, clients, onSent }: WhatsAppReminderModalProps) {
  const [templates, setTemplates] = useState<ReminderTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState("template");

  useEffect(() => {
    if (open) loadTemplates();
  }, [open]);

  async function loadTemplates() {
    const { data } = await supabase
      .from("sigma_reminder_templates")
      .select("*")
      .order("is_default", { ascending: false });
    const tpls = (data || []) as ReminderTemplate[];
    setTemplates(tpls);
    const def = tpls.find((t) => t.is_default);
    if (def) {
      setSelectedTemplateId(def.id);
      setCustomMessage(def.message);
    }
  }

  function handleTemplateSelect(id: string) {
    setSelectedTemplateId(id);
    const tpl = templates.find((t) => t.id === id);
    if (tpl) setCustomMessage(tpl.message);
  }

  const previewClient = clients[0];
  const previewText = useMemo(
    () => (previewClient ? processMessage(customMessage, previewClient) : customMessage),
    [customMessage, previewClient]
  );

  const disabledClients = useMemo(
    () => clients.filter((c) => !c.phone),
    [clients]
  );

  const sendableClients = useMemo(
    () => clients.filter((c) => !!c.phone),
    [clients]
  );

  async function handleSend() {
    if (!customMessage.trim() || sendableClients.length === 0) return;
    setSending(true);
    let sent = 0, errors = 0;

    for (const client of sendableClients) {
      const finalMessage = processMessage(customMessage, client);
      try {
        // Log the reminder
        await supabase.from("sigma_reminder_logs").insert({
          client_id: client.id,
          template_id: selectedTemplateId || null,
          message_sent: finalMessage,
          whatsapp_number: client.phone!,
          status: "sent",
        });
        // Update last_reminder_sent
        await supabase
          .from("sigma_blaze_clients")
          .update({ last_reminder_sent: new Date().toISOString() })
          .eq("id", client.id);
        sent++;
      } catch {
        errors++;
      }
    }

    if (sent > 0) toast.success(`${sent} lembrete(s) enviado(s)`);
    if (errors > 0) toast.error(`${errors} erro(s) ao enviar`);
    if (disabledClients.length > 0)
      toast.warning(`${disabledClients.length} cliente(s) sem telefone (ignorados)`);

    setSending(false);
    onSent();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Enviar Lembrete via WhatsApp ({clients.length} cliente{clients.length > 1 ? "s" : ""})
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="template" className="flex-1">Usar Template</TabsTrigger>
            <TabsTrigger value="manual" className="flex-1">Mensagem Manual</TabsTrigger>
            <TabsTrigger value="preview" className="flex-1">Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="template" className="space-y-4 mt-4">
            <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha um template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} {t.is_default && <Badge variant="secondary" className="ml-2 text-[10px]">Padrão</Badge>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplateId && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-sm whitespace-pre-wrap">{customMessage}</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Variáveis: {"{{nome}}"}, {"{{data_vencimento}}"}, {"{{dias_restantes}}"}
            </p>
          </TabsContent>

          <TabsContent value="manual" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Escreva sua mensagem</Label>
              <Textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={5}
                placeholder="Olá {{nome}}, seu plano vence em {{dias_restantes}} dias..."
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Variáveis: {"{{nome}}"}, {"{{data_vencimento}}"}, {"{{dias_restantes}}"}</span>
                <span>{customMessage.length} caracteres</span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="preview" className="mt-4 space-y-3">
            <Label className="flex items-center gap-2">
              <Eye className="h-4 w-4" /> Preview da Mensagem
            </Label>
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-sm whitespace-pre-wrap">{previewText}</p>
            </div>
            {clients.length > 1 && (
              <p className="text-xs text-muted-foreground">Preview usando: {previewClient?.full_name}</p>
            )}
            <Separator />
            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                Aptos para envio: <strong>{sendableClients.length}</strong>
                {disabledClients.length > 0 && (
                  <span className="text-amber-500 ml-2">({disabledClients.length} sem telefone)</span>
                )}
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleSend}
            disabled={sending || !customMessage.trim() || sendableClients.length === 0}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Enviar ({sendableClients.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
