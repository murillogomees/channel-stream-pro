import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Send, Plus, Eye, MessageCircle } from "lucide-react";
import * as clientService from "@/services/sigmaBlaze/sigmaClientsService";
import type { SigmaClient, SigmaReminderTemplate } from "@/services/sigmaBlaze/sigmaClientsService";

interface ReminderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: SigmaClient[];
  onSent: () => void;
}

export function ReminderModal({ open, onOpenChange, clients, onSent }: ReminderModalProps) {
  const [templates, setTemplates] = useState<SigmaReminderTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [customMessage, setCustomMessage] = useState("");
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateMsg, setNewTemplateMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [activeTab, setActiveTab] = useState("select");

  useEffect(() => {
    if (open) loadTemplates();
  }, [open]);

  async function loadTemplates() {
    const tpls = await clientService.getTemplates();
    setTemplates(tpls);
    const def = tpls.find(t => t.is_default);
    if (def) {
      setSelectedTemplateId(def.id);
      setCustomMessage(def.message);
    }
  }

  function handleTemplateSelect(id: string) {
    setSelectedTemplateId(id);
    const tpl = templates.find(t => t.id === id);
    if (tpl) setCustomMessage(tpl.message);
  }

  async function handleCreateTemplate() {
    if (!newTemplateName || !newTemplateMsg) return;
    setSavingTemplate(true);
    try {
      await clientService.createTemplate({ name: newTemplateName, message: newTemplateMsg });
      toast.success("Template criado!");
      setNewTemplateName("");
      setNewTemplateMsg("");
      await loadTemplates();
      setActiveTab("select");
    } catch {
      toast.error("Erro ao criar template");
    } finally {
      setSavingTemplate(false);
    }
  }

  async function handleSend() {
    if (!customMessage.trim()) return;
    setSending(true);
    try {
      const result = await clientService.sendBulkReminders(
        clients.map(c => c.id),
        customMessage,
        selectedTemplateId || undefined,
        clients
      );
      toast.success(`Enviados: ${result.sent} | Ignorados: ${result.skipped} | Erros: ${result.errors}`);
      onSent();
      onOpenChange(false);
    } catch {
      toast.error("Erro ao enviar lembretes");
    } finally {
      setSending(false);
    }
  }

  // Preview with first client
  const previewClient = clients[0];
  const previewText = previewClient ? clientService.renderTemplate(customMessage, previewClient) : customMessage;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Enviar Lembrete ({clients.length} cliente{clients.length > 1 ? "s" : ""})
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="select" className="flex-1">Selecionar Template</TabsTrigger>
            <TabsTrigger value="create" className="flex-1">Criar Novo</TabsTrigger>
            <TabsTrigger value="preview" className="flex-1">Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="select" className="space-y-4 mt-4">
            <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha um template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} {t.is_default && <Badge variant="secondary" className="ml-2 text-[10px]">Padrão</Badge>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="space-y-2">
              <Label>Mensagem (editável)</Label>
              <Textarea value={customMessage} onChange={e => setCustomMessage(e.target.value)} rows={4} />
              <p className="text-xs text-muted-foreground">
                Variáveis: {"{{nome}}"}, {"{{plano}}"}, {"{{data_vencimento}}"}, {"{{dias_restantes}}"}
              </p>
            </div>
          </TabsContent>

          <TabsContent value="create" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Nome do Template</Label>
              <Input value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)} placeholder="Ex: Lembrete Urgente" />
            </div>
            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea value={newTemplateMsg} onChange={e => setNewTemplateMsg(e.target.value)} rows={4} placeholder="Olá {{nome}}, ..." />
            </div>
            <Button onClick={handleCreateTemplate} disabled={savingTemplate || !newTemplateName || !newTemplateMsg}>
              {savingTemplate ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Salvar Template
            </Button>
          </TabsContent>

          <TabsContent value="preview" className="mt-4">
            <div className="space-y-3">
              <Label className="flex items-center gap-2"><Eye className="h-4 w-4" /> Preview da Mensagem</Label>
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-sm whitespace-pre-wrap">{previewText}</p>
              </div>
              {clients.length > 1 && (
                <p className="text-xs text-muted-foreground">Preview usando: {previewClient?.name}</p>
              )}
              <Separator />
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Destinatários: <strong>{clients.length}</strong></p>
                {clients.slice(0, 5).map(c => {
                  const check = clientService.canSendReminder(c);
                  return (
                    <div key={c.id} className="flex items-center gap-2">
                      <span>{c.name}</span>
                      {!check.allowed && <Badge variant="outline" className="text-[10px] text-amber-600">{check.reason}</Badge>}
                    </div>
                  );
                })}
                {clients.length > 5 && <p>...e mais {clients.length - 5}</p>}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSend} disabled={sending || !customMessage.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
