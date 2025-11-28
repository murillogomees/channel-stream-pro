import { useState } from "react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useSubscriptionPlans, SubscriptionPlan } from "@/hooks/useSubscriptionPlans";
import { Plus, Edit, Trash2, Star, GripVertical, Eye, EyeOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminPlansManager() {
  const { plans, loading, fetchPlans, createPlan, updatePlan, deletePlan } = useSubscriptionPlans();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    price: "",
    currency: "R$",
    period: "",
    period_months: "1",
    features: "",
    cta_text: "Assinar Agora",
    is_highlighted: false,
    savings_amount: "",
    savings_percent: "",
    is_active: true,
    display_order: "0",
    whatsapp_message: "",
  });

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      price: "",
      currency: "R$",
      period: "",
      period_months: "1",
      features: "",
      cta_text: "Assinar Agora",
      is_highlighted: false,
      savings_amount: "",
      savings_percent: "",
      is_active: true,
      display_order: "0",
      whatsapp_message: "",
    });
    setEditingPlan(null);
  };

  const openEditDialog = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      slug: plan.slug,
      price: plan.price.toString(),
      currency: plan.currency,
      period: plan.period,
      period_months: plan.period_months.toString(),
      features: plan.features.join("\n"),
      cta_text: plan.cta_text,
      is_highlighted: plan.is_highlighted,
      savings_amount: plan.savings_amount?.toString() || "",
      savings_percent: plan.savings_percent?.toString() || "",
      is_active: plan.is_active,
      display_order: plan.display_order.toString(),
      whatsapp_message: plan.whatsapp_message || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const planData = {
      name: formData.name,
      slug: formData.slug || formData.name.toLowerCase().replace(/\s+/g, '-'),
      price: parseFloat(formData.price),
      currency: formData.currency,
      period: formData.period,
      period_months: parseInt(formData.period_months),
      features: formData.features.split("\n").filter(f => f.trim()),
      cta_text: formData.cta_text,
      is_highlighted: formData.is_highlighted,
      savings_amount: formData.savings_amount ? parseFloat(formData.savings_amount) : null,
      savings_percent: formData.savings_percent ? parseFloat(formData.savings_percent) : null,
      is_active: formData.is_active,
      display_order: parseInt(formData.display_order),
      whatsapp_message: formData.whatsapp_message || null,
    };

    if (editingPlan) {
      await updatePlan(editingPlan.id, planData);
    } else {
      await createPlan(planData);
    }

    setIsDialogOpen(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este plano?")) {
      await deletePlan(id);
    }
  };

  const togglePlanStatus = async (plan: SubscriptionPlan) => {
    await updatePlan(plan.id, { is_active: !plan.is_active });
  };

  const toggleHighlight = async (plan: SubscriptionPlan) => {
    // Se estiver destacando este, remover destaque dos outros
    if (!plan.is_highlighted) {
      for (const p of plans) {
        if (p.is_highlighted && p.id !== plan.id) {
          await updatePlan(p.id, { is_highlighted: false });
        }
      }
    }
    await updatePlan(plan.id, { is_highlighted: !plan.is_highlighted });
  };

  // Carregar planos incluindo inativos
  useState(() => {
    fetchPlans(true);
  });

  if (loading) {
    return (
      <div className="container mx-auto p-3 sm:p-6 max-w-7xl overflow-x-hidden">
        <PageHeader title="Gerenciar Planos" description="Crie e edite os planos de assinatura" />
        <div className="grid gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3 sm:p-6 max-w-7xl overflow-x-hidden">
      <PageHeader 
        title="Gerenciar Planos" 
        description="Crie e edite os planos de assinatura exibidos na página inicial" 
      />

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <p className="text-muted-foreground">
          {plans.length} plano(s) cadastrado(s)
        </p>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Plano
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPlan ? "Editar Plano" : "Novo Plano"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Plano *</Label>
                  <Input
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Mensal"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slug (URL)</Label>
                  <Input
                    value={formData.slug}
                    onChange={e => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="Ex: mensal"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Preço *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={e => setFormData({ ...formData, price: e.target.value })}
                    placeholder="30.00"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Moeda</Label>
                  <Input
                    value={formData.currency}
                    onChange={e => setFormData({ ...formData, currency: e.target.value })}
                    placeholder="R$"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Período *</Label>
                  <Input
                    value={formData.period}
                    onChange={e => setFormData({ ...formData, period: e.target.value })}
                    placeholder="/mês"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Duração (meses)</Label>
                  <Input
                    type="number"
                    value={formData.period_months}
                    onChange={e => setFormData({ ...formData, period_months: e.target.value })}
                    placeholder="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ordem de Exibição</Label>
                  <Input
                    type="number"
                    value={formData.display_order}
                    onChange={e => setFormData({ ...formData, display_order: e.target.value })}
                    placeholder="1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Características (uma por linha) *</Label>
                <Textarea
                  value={formData.features}
                  onChange={e => setFormData({ ...formData, features: e.target.value })}
                  placeholder="Mais de 10.000 canais&#10;Qualidade Full HD e 4K&#10;Suporte 24/7"
                  rows={5}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Economia (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.savings_amount}
                    onChange={e => setFormData({ ...formData, savings_amount: e.target.value })}
                    placeholder="10.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Economia (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.savings_percent}
                    onChange={e => setFormData({ ...formData, savings_percent: e.target.value })}
                    placeholder="11.2"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Texto do Botão</Label>
                <Input
                  value={formData.cta_text}
                  onChange={e => setFormData({ ...formData, cta_text: e.target.value })}
                  placeholder="Assinar Agora"
                />
              </div>

              <div className="space-y-2">
                <Label>Mensagem WhatsApp</Label>
                <Textarea
                  value={formData.whatsapp_message}
                  onChange={e => setFormData({ ...formData, whatsapp_message: e.target.value })}
                  placeholder="Olá! Tenho interesse no plano..."
                  rows={2}
                />
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={checked => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label>Plano Ativo</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_highlighted}
                    onCheckedChange={checked => setFormData({ ...formData, is_highlighted: checked })}
                  />
                  <Label>Destacar como "Mais Popular"</Label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingPlan ? "Salvar Alterações" : "Criar Plano"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {plans.map((plan) => (
          <Card key={plan.id} className={`${!plan.is_active ? 'opacity-60' : ''} ${plan.is_highlighted ? 'border-primary' : ''}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  {plan.is_highlighted && (
                    <Badge variant="default" className="bg-primary">
                      <Star className="h-3 w-3 mr-1" />
                      Mais Popular
                    </Badge>
                  )}
                  {!plan.is_active && (
                    <Badge variant="secondary">Inativo</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => togglePlanStatus(plan)}
                    title={plan.is_active ? "Desativar" : "Ativar"}
                  >
                    {plan.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleHighlight(plan)}
                    title={plan.is_highlighted ? "Remover destaque" : "Destacar"}
                  >
                    <Star className={`h-4 w-4 ${plan.is_highlighted ? 'fill-primary text-primary' : ''}`} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(plan)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(plan.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Preço:</span>
                  <p className="font-semibold text-lg">{plan.currency} {plan.price.toFixed(2)}{plan.period}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Duração:</span>
                  <p>{plan.period_months} {plan.period_months === 1 ? 'mês' : 'meses'}</p>
                </div>
                {plan.savings_percent && (
                  <div>
                    <span className="text-muted-foreground">Economia:</span>
                    <p className="text-success">{plan.savings_percent}% ({plan.currency} {plan.savings_amount?.toFixed(2)})</p>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Características:</span>
                  <p>{plan.features.length} itens</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {plan.features.slice(0, 4).map((feature, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {feature}
                  </Badge>
                ))}
                {plan.features.length > 4 && (
                  <Badge variant="outline" className="text-xs">
                    +{plan.features.length - 4} mais
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
