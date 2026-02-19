/**
 * Admin - Gerenciamento de Documentos Legais
 * CRUD de versões, ativação, histórico de aceites
 */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Plus, Eye, Users, Loader2, Shield, CheckCircle2, Clock } from "lucide-react";

interface LegalDocument {
  id: string;
  type: string;
  version: string;
  title: string;
  content: string;
  is_active: boolean;
  created_at: string;
}

interface Acceptance {
  id: string;
  user_id: string;
  document_type: string;
  document_version: string;
  accepted_at: string;
  user_agent: string | null;
}

export default function AdminLegalDocuments() {
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [acceptances, setAcceptances] = useState<Acceptance[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAcceptancesDialog, setShowAcceptancesDialog] = useState(false);
  const [newDoc, setNewDoc] = useState({ type: "terms", version: "", title: "", content: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [docsRes, accRes] = await Promise.all([
      supabase.from("legal_documents").select("*").order("created_at", { ascending: false }),
      supabase.from("user_legal_acceptance").select("*").order("accepted_at", { ascending: false }).limit(100),
    ]);
    setDocuments((docsRes.data || []) as LegalDocument[]);
    setAcceptances((accRes.data || []) as Acceptance[]);
    setLoading(false);
  }

  async function handleCreateDocument() {
    if (!newDoc.version || !newDoc.title || !newDoc.content) {
      toast.error("Preencha todos os campos");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("legal_documents").insert({
      type: newDoc.type,
      version: newDoc.version,
      title: newDoc.title,
      content: newDoc.content,
      is_active: false,
    });
    if (error) {
      toast.error("Erro ao criar documento: " + error.message);
    } else {
      toast.success("Documento criado!");
      setShowCreateDialog(false);
      setNewDoc({ type: "terms", version: "", title: "", content: "" });
      loadData();
    }
    setSaving(false);
  }

  async function handleToggleActive(doc: LegalDocument) {
    const { error } = await supabase
      .from("legal_documents")
      .update({ is_active: !doc.is_active })
      .eq("id", doc.id);
    if (error) {
      toast.error("Erro ao alterar status");
    } else {
      toast.success(doc.is_active ? "Documento desativado" : "Documento ativado como versão atual");
      loadData();
    }
  }

  const filtered = filterType === "all" ? documents : documents.filter(d => d.type === filterType);
  const termsAcceptances = acceptances.filter(a => a.document_type === "terms").length;
  const privacyAcceptances = acceptances.filter(a => a.document_type === "privacy").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{documents.length}</p>
              <p className="text-xs text-muted-foreground">Documentos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{termsAcceptances}</p>
              <p className="text-xs text-muted-foreground">Aceites de Termos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Shield className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{privacyAcceptances}</p>
              <p className="text-xs text-muted-foreground">Aceites de Privacidade</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Nova Versão
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar Nova Versão</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={newDoc.type} onValueChange={v => setNewDoc(p => ({ ...p, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="terms">Termos de Uso</SelectItem>
                      <SelectItem value="privacy">Política de Privacidade</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Versão</Label>
                  <Input placeholder="ex: 1.1.0" value={newDoc.version} onChange={e => setNewDoc(p => ({ ...p, version: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Título</Label>
                <Input placeholder="Termos de Uso" value={newDoc.title} onChange={e => setNewDoc(p => ({ ...p, title: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Conteúdo (HTML)</Label>
                <Textarea
                  placeholder="<h2>Seção 1</h2><p>Conteúdo...</p>"
                  value={newDoc.content}
                  onChange={e => setNewDoc(p => ({ ...p, content: e.target.value }))}
                  rows={12}
                  className="font-mono text-xs"
                />
              </div>
              <Button onClick={handleCreateDocument} disabled={saving} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Criar Documento
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showAcceptancesDialog} onOpenChange={setShowAcceptancesDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Users className="h-4 w-4 mr-2" />
              Ver Aceites
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Histórico de Aceites</DialogTitle>
            </DialogHeader>
            <ScrollArea className="h-[400px] mt-4">
              {acceptances.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum aceite registrado</p>
              ) : (
                <div className="space-y-2">
                  {acceptances.map(a => (
                    <div key={a.id} className="flex items-center gap-3 p-2 rounded border text-sm">
                      <Badge variant={a.document_type === "terms" ? "default" : "secondary"}>
                        {a.document_type === "terms" ? "Termos" : "Privacidade"}
                      </Badge>
                      <span className="text-xs font-mono">v{a.document_version}</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {new Date(a.accepted_at).toLocaleString("pt-BR")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="terms">Termos</SelectItem>
            <SelectItem value="privacy">Privacidade</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Versões</CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum documento encontrado</p>
          ) : (
            <div className="space-y-3">
              {filtered.map(doc => (
                <div key={doc.id} className="flex items-center gap-4 p-4 rounded-lg border bg-card">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={doc.type === "terms" ? "default" : "secondary"}>
                        {doc.type === "terms" ? "Termos" : "Privacidade"}
                      </Badge>
                      <span className="text-sm font-mono font-medium">v{doc.version}</span>
                      {doc.is_active && (
                        <Badge variant="outline" className="text-green-600 border-green-600">Ativo</Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium text-foreground">{doc.title}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Clock className="h-3 w-3" />
                      {new Date(doc.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={doc.is_active} onCheckedChange={() => handleToggleActive(doc)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
