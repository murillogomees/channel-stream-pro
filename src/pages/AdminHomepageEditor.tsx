import { useState, useEffect } from "react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useHomepageContent, HomepageFAQ } from "@/hooks/useHomepageContent";
import { Save, Plus, Edit, Trash2, Eye, EyeOff, ArrowUp, ArrowDown, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminHomepageEditor() {
  const { content, faqs, loading, fetchFAQs, updateContent, createFAQ, updateFAQ, deleteFAQ } = useHomepageContent();
  
  // Estados para cada seção
  const [heroData, setHeroData] = useState({
    description: "",
    features: [] as string[],
    cta_primary_text: "",
    cta_secondary_text: "",
    trust_indicators: [] as string[],
    whatsapp_number: "",
    whatsapp_message: "",
  });

  const [plansData, setPlansData] = useState({
    title: "",
    subtitle: "",
    trial_text: "",
    benefits: [] as string[],
    whatsapp_number: "",
  });

  const [faqData, setFaqData] = useState({
    title: "",
    subtitle: "",
    contact_text: "",
    contact_button_text: "",
    whatsapp_number: "",
    whatsapp_message: "",
  });

  const [contactData, setContactData] = useState({
    whatsapp_number: "",
    operating_hours: "",
    support_services: [] as string[],
  });

  const [footerData, setFooterData] = useState({
    copyright: "",
  });

  // FAQ Dialog
  const [faqDialogOpen, setFaqDialogOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<HomepageFAQ | null>(null);
  const [faqForm, setFaqForm] = useState({
    question: "",
    answer: "",
    display_order: 0,
    is_active: true,
  });

  // Carregar dados do banco
  useEffect(() => {
    if (content.hero) {
      setHeroData(content.hero.content as typeof heroData);
    }
    if (content.plans) {
      setPlansData(content.plans.content as typeof plansData);
    }
    if (content.faq) {
      setFaqData(content.faq.content as typeof faqData);
    }
    if (content.contact) {
      setContactData(content.contact.content as typeof contactData);
    }
    if (content.footer) {
      setFooterData(content.footer.content as typeof footerData);
    }
    fetchFAQs(true);
  }, [content]);

  const saveSection = async (section: string, data: any) => {
    await updateContent(section, data);
  };

  const openFaqDialog = (faq?: HomepageFAQ) => {
    if (faq) {
      setEditingFaq(faq);
      setFaqForm({
        question: faq.question,
        answer: faq.answer,
        display_order: faq.display_order,
        is_active: faq.is_active,
      });
    } else {
      setEditingFaq(null);
      setFaqForm({
        question: "",
        answer: "",
        display_order: faqs.length + 1,
        is_active: true,
      });
    }
    setFaqDialogOpen(true);
  };

  const handleFaqSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingFaq) {
      await updateFAQ(editingFaq.id, faqForm);
    } else {
      await createFAQ(faqForm);
    }
    setFaqDialogOpen(false);
  };

  const handleDeleteFaq = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta FAQ?")) {
      await deleteFAQ(id);
    }
  };

  const moveFaq = async (faq: HomepageFAQ, direction: 'up' | 'down') => {
    const newOrder = direction === 'up' ? faq.display_order - 1 : faq.display_order + 1;
    await updateFAQ(faq.id, { display_order: newOrder });
  };

  if (loading) {
    return (
      <div className="container mx-auto p-3 sm:p-6 max-w-7xl overflow-x-hidden">
        <PageHeader title="Editor da Homepage" description="Edite os textos e elementos da página inicial" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3 sm:p-6 max-w-7xl overflow-x-hidden">
      <PageHeader 
        title="Editor da Homepage" 
        description="Edite os textos e elementos da página inicial sem mexer no código" 
      />

      <div className="mb-4">
        <Button variant="outline" asChild>
          <a href="/" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />
            Visualizar Homepage
          </a>
        </Button>
      </div>

      <Tabs defaultValue="hero" className="space-y-4">
        <ScrollArea className="w-full whitespace-nowrap">
          <TabsList className="inline-flex h-auto min-w-full p-1">
            <TabsTrigger value="hero" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm">Hero</TabsTrigger>
            <TabsTrigger value="plans" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm">Planos</TabsTrigger>
            <TabsTrigger value="faqs" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm">FAQs</TabsTrigger>
            <TabsTrigger value="contact" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm">Contato</TabsTrigger>
            <TabsTrigger value="footer" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm">Rodapé</TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>

        {/* HERO SECTION */}
        <TabsContent value="hero">
          <Card>
            <CardHeader>
              <CardTitle>Seção Hero (Principal)</CardTitle>
              <CardDescription>Configure o banner principal da página</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Descrição Principal</Label>
                <Textarea
                  value={heroData.description}
                  onChange={e => setHeroData({ ...heroData, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Destaques (separados por vírgula)</Label>
                <Input
                  value={heroData.features?.join(", ")}
                  onChange={e => setHeroData({ ...heroData, features: e.target.value.split(",").map(f => f.trim()) })}
                  placeholder="Teste Grátis 15 Dias, Sem Contrato, Suporte 24/7"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Texto Botão Principal</Label>
                  <Input
                    value={heroData.cta_primary_text}
                    onChange={e => setHeroData({ ...heroData, cta_primary_text: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Texto Botão Secundário</Label>
                  <Input
                    value={heroData.cta_secondary_text}
                    onChange={e => setHeroData({ ...heroData, cta_secondary_text: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Indicadores de Confiança (separados por vírgula)</Label>
                <Input
                  value={heroData.trust_indicators?.join(", ")}
                  onChange={e => setHeroData({ ...heroData, trust_indicators: e.target.value.split(",").map(f => f.trim()) })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Número WhatsApp</Label>
                  <Input
                    value={heroData.whatsapp_number}
                    onChange={e => setHeroData({ ...heroData, whatsapp_number: e.target.value })}
                    placeholder="556131425880"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mensagem WhatsApp</Label>
                  <Input
                    value={heroData.whatsapp_message}
                    onChange={e => setHeroData({ ...heroData, whatsapp_message: e.target.value })}
                  />
                </div>
              </div>

              <Button onClick={() => saveSection('hero', heroData)}>
                <Save className="h-4 w-4 mr-2" />
                Salvar Hero
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PLANS SECTION */}
        <TabsContent value="plans">
          <Card>
            <CardHeader>
              <CardTitle>Seção de Planos</CardTitle>
              <CardDescription>Configure os textos da seção de planos (os planos em si são gerenciados separadamente)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input
                    value={plansData.title}
                    onChange={e => setPlansData({ ...plansData, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Subtítulo</Label>
                  <Input
                    value={plansData.subtitle}
                    onChange={e => setPlansData({ ...plansData, subtitle: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Texto do Teste Grátis</Label>
                <Input
                  value={plansData.trial_text}
                  onChange={e => setPlansData({ ...plansData, trial_text: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Benefícios Adicionais (separados por vírgula)</Label>
                <Input
                  value={plansData.benefits?.join(", ")}
                  onChange={e => setPlansData({ ...plansData, benefits: e.target.value.split(",").map(f => f.trim()) })}
                />
              </div>

              <div className="space-y-2">
                <Label>Número WhatsApp</Label>
                <Input
                  value={plansData.whatsapp_number}
                  onChange={e => setPlansData({ ...plansData, whatsapp_number: e.target.value })}
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={() => saveSection('plans', plansData)}>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar
                </Button>
                <Button variant="outline" asChild>
                  <a href="/dashboard/plans">Gerenciar Planos →</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FAQS SECTION */}
        <TabsContent value="faqs">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Configurações da Seção FAQ</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Título</Label>
                    <Input
                      value={faqData.title}
                      onChange={e => setFaqData({ ...faqData, title: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Subtítulo</Label>
                    <Input
                      value={faqData.subtitle}
                      onChange={e => setFaqData({ ...faqData, subtitle: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Texto de Contato</Label>
                    <Input
                      value={faqData.contact_text}
                      onChange={e => setFaqData({ ...faqData, contact_text: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Texto do Botão</Label>
                    <Input
                      value={faqData.contact_button_text}
                      onChange={e => setFaqData({ ...faqData, contact_button_text: e.target.value })}
                    />
                  </div>
                </div>

                <Button onClick={() => saveSection('faq', faqData)}>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Configurações
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Perguntas Frequentes</CardTitle>
                  <CardDescription>{faqs.length} FAQs cadastradas</CardDescription>
                </div>
                <Dialog open={faqDialogOpen} onOpenChange={setFaqDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => openFaqDialog()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Nova FAQ
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingFaq ? "Editar FAQ" : "Nova FAQ"}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleFaqSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Pergunta *</Label>
                        <Input
                          value={faqForm.question}
                          onChange={e => setFaqForm({ ...faqForm, question: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Resposta *</Label>
                        <Textarea
                          value={faqForm.answer}
                          onChange={e => setFaqForm({ ...faqForm, answer: e.target.value })}
                          rows={4}
                          required
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={faqForm.is_active}
                          onCheckedChange={checked => setFaqForm({ ...faqForm, is_active: checked })}
                        />
                        <Label>FAQ Ativa</Label>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setFaqDialogOpen(false)}>
                          Cancelar
                        </Button>
                        <Button type="submit">Salvar</Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {faqs.map((faq, index) => (
                    <div
                      key={faq.id}
                      className={`flex items-center justify-between p-3 border rounded-lg ${!faq.is_active ? 'opacity-50' : ''}`}
                    >
                      <div className="flex-1">
                        <p className="font-medium">{faq.question}</p>
                        <p className="text-sm text-muted-foreground line-clamp-1">{faq.answer}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {!faq.is_active && <Badge variant="secondary">Inativa</Badge>}
                        <Button variant="ghost" size="icon" onClick={() => moveFaq(faq, 'up')} disabled={index === 0}>
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => moveFaq(faq, 'down')} disabled={index === faqs.length - 1}>
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => updateFAQ(faq.id, { is_active: !faq.is_active })}>
                          {faq.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openFaqDialog(faq)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteFaq(faq.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* CONTACT SECTION */}
        <TabsContent value="contact">
          <Card>
            <CardHeader>
              <CardTitle>Seção de Contato</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Número WhatsApp</Label>
                  <Input
                    value={contactData.whatsapp_number}
                    onChange={e => setContactData({ ...contactData, whatsapp_number: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Horário de Funcionamento</Label>
                  <Input
                    value={contactData.operating_hours}
                    onChange={e => setContactData({ ...contactData, operating_hours: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Serviços de Suporte (separados por vírgula)</Label>
                <Textarea
                  value={contactData.support_services?.join(", ")}
                  onChange={e => setContactData({ ...contactData, support_services: e.target.value.split(",").map(f => f.trim()) })}
                  rows={2}
                />
              </div>

              <Button onClick={() => saveSection('contact', contactData)}>
                <Save className="h-4 w-4 mr-2" />
                Salvar Contato
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FOOTER SECTION */}
        <TabsContent value="footer">
          <Card>
            <CardHeader>
              <CardTitle>Rodapé</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Texto de Copyright</Label>
                <Input
                  value={footerData.copyright}
                  onChange={e => setFooterData({ ...footerData, copyright: e.target.value })}
                />
              </div>

              <Button onClick={() => saveSection('footer', footerData)}>
                <Save className="h-4 w-4 mr-2" />
                Salvar Rodapé
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
