import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useLocalAuth } from "@/hooks/useLocalAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, CheckCircle, XCircle, Clock, Mail, AlertCircle, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Prospecto {
  id: string;
  nome: string;
  email: string;
  celular: string;
  mac: string;
  status: string;
  observacoes?: string;
  created_at: string;
}

const AdminProspectos = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useLocalAuth();
  const [prospectos, setProspectos] = useState<Prospecto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProspecto, setSelectedProspecto] = useState<Prospecto | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [observacoes, setObservacoes] = useState("");
  const [actionType, setActionType] = useState<"validar" | "rejeitar">("validar");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/admin/login");
    }
  }, [isAuthenticated, authLoading, navigate]);

  useEffect(() => {
    if (isAuthenticated) {
      loadProspectos();
    }
  }, [isAuthenticated]);

  const loadProspectos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("prospectos")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setProspectos(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar prospectos:", error);
      toast({
        title: "Erro ao carregar prospectos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (prospecto: Prospecto, action: "validar" | "rejeitar") => {
    setSelectedProspecto(prospecto);
    setActionType(action);
    setObservacoes(prospecto.observacoes || "");
    setDialogOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!selectedProspecto) return;

    try {
      const newStatus = actionType === "validar" ? "validado" : "rejeitado";

      const { error: updateError } = await supabase
        .from("prospectos")
        .update({
          status: newStatus,
          observacoes,
        })
        .eq("id", selectedProspecto.id);

      if (updateError) throw updateError;

      // Se validado, enviar email de boas-vindas
      if (actionType === "validar") {
        try {
          const { error: emailError } = await supabase.functions.invoke("send-welcome-email", {
            body: {
              email: selectedProspecto.email,
              nome: selectedProspecto.nome,
              mac: selectedProspecto.mac,
            },
          });

          if (emailError) {
            console.error("Erro ao enviar email:", emailError);
            toast({
              title: "Prospecto validado, mas houve erro no envio do email",
              description: "O email de boas-vindas não foi enviado. Tente novamente manualmente.",
              variant: "destructive",
            });
          }
        } catch (emailError) {
          console.error("Erro ao enviar email:", emailError);
        }
      }

      toast({
        title: actionType === "validar" ? "Prospecto validado!" : "Prospecto rejeitado",
        description:
          actionType === "validar"
            ? "Email de boas-vindas enviado com sucesso!"
            : "O prospecto foi marcado como rejeitado.",
      });

      setDialogOpen(false);
      setSelectedProspecto(null);
      setObservacoes("");
      loadProspectos();
    } catch (error: any) {
      console.error("Erro ao processar ação:", error);
      toast({
        title: "Erro ao processar ação",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "aguardando_validacao":
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" /> Aguardando
          </Badge>
        );
      case "validado":
        return (
          <Badge className="gap-1 bg-green-600 hover:bg-green-700">
            <CheckCircle className="h-3 w-3" /> Validado
          </Badge>
        );
      case "rejeitado":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" /> Rejeitado
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const stats = {
    total: prospectos.length,
    aguardando: prospectos.filter((p) => p.status === "aguardando_validacao").length,
    validados: prospectos.filter((p) => p.status === "validado").length,
    rejeitados: prospectos.filter((p) => p.status === "rejeitado").length,
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Gerenciar Prospectos</h1>
              <p className="text-sm text-muted-foreground">Validar e aprovar novos cadastros</p>
            </div>
          </div>

          {/* Cards de Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Aguardando
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{stats.aguardando}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" /> Validados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.validados}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <XCircle className="h-4 w-4" /> Rejeitados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{stats.rejeitados}</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Lista de Prospectos</CardTitle>
                <CardDescription>Gerencie os cadastros recebidos via formulário de tutorial</CardDescription>
              </div>
              <Button variant="outline" size="icon" onClick={loadProspectos} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Carregando...</p>
            ) : prospectos.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhum prospecto cadastrado ainda</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Celular</TableHead>
                      <TableHead>MAC Address</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prospectos.map((prospecto) => (
                      <TableRow key={prospecto.id}>
                        <TableCell className="font-medium">{prospecto.nome}</TableCell>
                        <TableCell>{prospecto.email}</TableCell>
                        <TableCell>{prospecto.celular}</TableCell>
                        <TableCell>
                          <code className="bg-muted px-2 py-1 rounded text-xs">{prospecto.mac}</code>
                        </TableCell>
                        <TableCell>{new Date(prospecto.created_at).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell>{getStatusBadge(prospecto.status)}</TableCell>
                        <TableCell className="text-right">
                          {prospecto.status === "aguardando_validacao" && (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleOpenDialog(prospecto, "validar")}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Validar
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleOpenDialog(prospecto, "rejeitar")}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Rejeitar
                              </Button>
                            </div>
                          )}
                          {prospecto.status !== "aguardando_validacao" && prospecto.observacoes && (
                            <p className="text-xs text-muted-foreground text-right">{prospecto.observacoes}</p>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Dialog de Confirmação */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "validar" ? "Validar Prospecto" : "Rejeitar Prospecto"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "validar"
                ? "Ao validar, um email de boas-vindas será enviado automaticamente para o usuário."
                : "Informe o motivo da rejeição (opcional)."}
            </DialogDescription>
          </DialogHeader>

          {selectedProspecto && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Nome:</span>
                  <p className="text-muted-foreground">{selectedProspecto.nome}</p>
                </div>
                <div>
                  <span className="font-medium">Email:</span>
                  <p className="text-muted-foreground">{selectedProspecto.email}</p>
                </div>
                <div>
                  <span className="font-medium">Celular:</span>
                  <p className="text-muted-foreground">{selectedProspecto.celular}</p>
                </div>
                <div>
                  <span className="font-medium">MAC:</span>
                  <p className="text-muted-foreground">
                    <code className="bg-muted px-2 py-1 rounded text-xs">{selectedProspecto.mac}</code>
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações {actionType === "rejeitar" && "(opcional)"}</Label>
                <Textarea
                  id="observacoes"
                  placeholder={
                    actionType === "validar"
                      ? "Adicionar notas internas sobre esta validação..."
                      : "Motivo da rejeição..."
                  }
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant={actionType === "validar" ? "default" : "destructive"}
              onClick={handleConfirmAction}
            >
              {actionType === "validar" ? (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Validar e Enviar Email
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Confirmar Rejeição
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminProspectos;
