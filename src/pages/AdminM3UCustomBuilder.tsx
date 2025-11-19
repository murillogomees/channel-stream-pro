import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useM3UCustom, useM3UCategories, useM3UChannels } from '@/hooks/useM3UCustom';
import { m3uCustomService } from '@/services/m3uCustomService';
import { m3uGeneratorService } from '@/services/m3uGeneratorService';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Save, Play, FileDown, Copy, Trash2, Edit, ArrowUp, ArrowDown, List, Upload, Eye } from 'lucide-react';

export default function AdminM3UCustomBuilder() {
  const { toast } = useToast();
  const { lists, isLoading, refresh: refreshLists } = useM3UCustom();
  
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  
  const { categories, refresh: refreshCategories } = useM3UCategories(selectedListId);
  const { channels, refresh: refreshChannels } = useM3UChannels(selectedCategoryId);
  
  const [isNewListDialogOpen, setIsNewListDialogOpen] = useState(false);
  const [isNewCategoryDialogOpen, setIsNewCategoryDialogOpen] = useState(false);
  const [isNewChannelDialogOpen, setIsNewChannelDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  
  const [newListData, setNewListData] = useState({ name: '', description: '', slug: '' });
  const [newCategoryData, setNewCategoryData] = useState({ name: '', display_name: '' });
  const [newChannelData, setNewChannelData] = useState({
    name: '',
    stream_url: '',
    tvg_id: '',
    tvg_name: '',
    tvg_logo: '',
  });
  const [importUrl, setImportUrl] = useState('');
  const [importContent, setImportContent] = useState('');
  const [m3uPreview, setM3uPreview] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<string>("");
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [editListName, setEditListName] = useState("");
  const [editCategoryName, setEditCategoryName] = useState("");
  const [editChannelName, setEditChannelName] = useState("");
  const [transferChannelId, setTransferChannelId] = useState<string | null>(null);
  const [transferToCategoryId, setTransferToCategoryId] = useState("");

  const selectedList = lists.find(l => l.id === selectedListId);
  const selectedCategory = categories.find(c => c.id === selectedCategoryId);

  const handleCreateList = async () => {
    try {
      await m3uCustomService.createList(newListData);
      toast({ title: 'Lista criada com sucesso!' });
      setIsNewListDialogOpen(false);
      setNewListData({ name: '', description: '', slug: '' });
      refreshLists();
    } catch (error: any) {
      toast({ title: 'Erro ao criar lista', description: error.message, variant: 'destructive' });
    }
  };

  const handleCreateCategory = async () => {
    if (!selectedListId) return;
    
    try {
      await m3uCustomService.addCategory({
        custom_list_id: selectedListId,
        name: newCategoryData.name,
        display_name: newCategoryData.display_name,
        order_position: categories.length
      });
      toast({ title: 'Categoria adicionada!' });
      setIsNewCategoryDialogOpen(false);
      setNewCategoryData({ name: '', display_name: '' });
      refreshCategories();
    } catch (error: any) {
      toast({ title: 'Erro ao adicionar categoria', description: error.message, variant: 'destructive' });
    }
  };

  const handleCreateChannel = async () => {
    if (!selectedCategoryId) return;
    
    try {
      await m3uCustomService.addChannel({
        category_id: selectedCategoryId,
        name: newChannelData.name,
        stream_url: newChannelData.stream_url,
        tvg_id: newChannelData.tvg_id,
        tvg_name: newChannelData.tvg_name,
        tvg_logo: newChannelData.tvg_logo,
        order_position: channels.length
      });
      toast({ title: 'Canal adicionado!' });
      setIsNewChannelDialogOpen(false);
      setNewChannelData({ name: '', stream_url: '', tvg_id: '', tvg_name: '', tvg_logo: '' });
      refreshChannels();
    } catch (error: any) {
      toast({ title: 'Erro ao adicionar canal', description: error.message, variant: 'destructive' });
    }
  };

  const handleImportM3U = async () => {
    if (!selectedListId) return;
    if (!importUrl && !importContent) {
      toast({
        title: 'Informe a URL ou cole o conteúdo da M3U',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      setIsImporting(true);
      setImportProgress("");
      
      let result;
      if (importContent.trim()) {
        setImportProgress("Processando conteúdo M3U...");
        result = await m3uCustomService.importFromContent(importContent, selectedListId);
      } else {
        setImportProgress("Conectando ao servidor...");
        await new Promise(resolve => setTimeout(resolve, 400));
        
        setImportProgress("Baixando arquivo M3U (até 60MB)...");
        await new Promise(resolve => setTimeout(resolve, 400));
        
        result = await m3uCustomService.importFromUrl(importUrl, selectedListId);
        
        setImportProgress("Processando canais...");
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      toast({
        title: 'M3U importado com sucesso!',
        description: `${result.categoriesCount} categorias e ${result.channelsCount} canais importados`,
      });
      setIsImportDialogOpen(false);
      setImportUrl('');
      setImportContent('');
      setImportProgress("");
      refreshCategories();
    } catch (error: any) {
      toast({ title: 'Erro ao importar M3U', description: error.message, variant: 'destructive' });
    } finally {
      setIsImporting(false);
      setImportProgress("");
    }
  };


  const handleGeneratePreview = async () => {
    if (!selectedListId) return;
    
    try {
      const preview = await m3uGeneratorService.generateM3U(selectedListId);
      setM3uPreview(preview);
      setIsPreviewDialogOpen(true);
    } catch (error: any) {
      toast({ title: 'Erro ao gerar preview', description: error.message, variant: 'destructive' });
    }
  };

  const handleGenerateAndPublish = async () => {
    if (!selectedListId) return;
    
    try {
      setIsGenerating(true);
      const { data, error } = await supabase.functions.invoke('generate-m3u-file', {
        body: { customListId: selectedListId }
      });

      if (error) throw error;

      toast({
        title: 'Lista publicada com sucesso!',
        description: `${data.channelsCount} canais, ${(data.fileSize / 1024).toFixed(2)} KB`
      });
      
      refreshLists();
    } catch (error: any) {
      toast({ title: 'Erro ao publicar lista', description: error.message, variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({ title: 'URL copiada!' });
  };

  const handleDeleteList = async (listId: string) => {
    if (!confirm('Tem certeza que deseja deletar esta lista?')) return;
    
    try {
      await m3uCustomService.deleteList(listId);
      toast({ title: 'Lista deletada!' });
      setSelectedListId(null);
      refreshLists();
    } catch (error: any) {
      toast({ title: 'Erro ao deletar lista', description: error.message, variant: 'destructive' });
    }
  };

  const handleEditList = (list: any) => {
    setEditingListId(list.id);
    setEditListName(list.name);
  };

  const handleSaveListName = async () => {
    if (!editingListId || !editListName.trim()) return;
    
    try {
      await m3uCustomService.updateList(editingListId, { name: editListName.trim() });
      toast({ title: 'Nome da lista atualizado!' });
      setEditingListId(null);
      refreshLists();
    } catch (error: any) {
      toast({ title: 'Erro ao atualizar lista', description: error.message, variant: 'destructive' });
    }
  };

  const handleEditCategory = (category: any) => {
    setEditingCategoryId(category.id);
    setEditCategoryName(category.display_name);
  };

  const handleSaveCategoryName = async () => {
    if (!editingCategoryId || !editCategoryName.trim()) return;
    
    try {
      await m3uCustomService.updateCategory(editingCategoryId, { 
        display_name: editCategoryName.trim(),
        name: editCategoryName.trim().toLowerCase().replace(/\s+/g, '_')
      });
      toast({ title: 'Nome da categoria atualizado!' });
      setEditingCategoryId(null);
      refreshCategories();
    } catch (error: any) {
      toast({ title: 'Erro ao atualizar categoria', description: error.message, variant: 'destructive' });
    }
  };

  const handleEditChannel = (channel: any) => {
    setEditingChannelId(channel.id);
    setEditChannelName(channel.name);
  };

  const handleSaveChannelName = async () => {
    if (!editingChannelId || !editChannelName.trim()) return;
    
    try {
      await m3uCustomService.updateChannel(editingChannelId, { name: editChannelName.trim() });
      toast({ title: 'Nome do canal atualizado!' });
      setEditingChannelId(null);
      refreshChannels();
    } catch (error: any) {
      toast({ title: 'Erro ao atualizar canal', description: error.message, variant: 'destructive' });
    }
  };

  const handleTransferChannel = async () => {
    if (!transferChannelId || !transferToCategoryId) return;
    
    try {
      await m3uCustomService.updateChannel(transferChannelId, { category_id: transferToCategoryId });
      toast({ title: 'Canal transferido!' });
      setTransferChannelId(null);
      setTransferToCategoryId("");
      refreshChannels();
    } catch (error: any) {
      toast({ title: 'Erro ao transferir canal', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Editor de Listas M3U Personalizadas</h1>
          <p className="text-muted-foreground">Crie e gerencie suas listas de canais IPTV</p>
        </div>
        
        <Dialog open={isNewListDialogOpen} onOpenChange={setIsNewListDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Lista
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Lista M3U</DialogTitle>
              <DialogDescription>Preencha os dados da nova lista personalizada</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome da Lista</Label>
                <Input
                  value={newListData.name}
                  onChange={(e) => setNewListData({ ...newListData, name: e.target.value })}
                  placeholder="Premium Esportes"
                />
              </div>
              <div>
                <Label>Slug (URL)</Label>
                <Input
                  value={newListData.slug}
                  onChange={(e) => setNewListData({ ...newListData, slug: e.target.value })}
                  placeholder="premium-esportes"
                />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={newListData.description}
                  onChange={(e) => setNewListData({ ...newListData, description: e.target.value })}
                  placeholder="Lista com canais esportivos em HD..."
                />
              </div>
              <Button onClick={handleCreateList} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Criar Lista
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna 1: Listas */}
        <Card>
          <CardHeader>
            <CardTitle>Listas M3U</CardTitle>
            <CardDescription>{lists.length} lista(s) criada(s)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : lists.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma lista criada</p>
            ) : (
              lists.map((list) => (
                <Card
                  key={list.id}
                  className={`cursor-pointer transition-colors ${
                    selectedListId === list.id ? 'border-primary' : ''
                  }`}
                  onClick={() => setSelectedListId(list.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start gap-2">
                      {editingListId === list.id ? (
                        <div className="flex-1 flex gap-2">
                          <Input
                            value={editListName}
                            onChange={(e) => setEditListName(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-8"
                          />
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); handleSaveListName(); }}>
                            <Save className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1">
                            <h3 className="font-semibold">{list.name}</h3>
                            <p className="text-xs text-muted-foreground">{list.slug}</p>
                            <div className="flex gap-2 mt-2">
                              <Badge variant="secondary">{list.total_categories} categorias</Badge>
                              <Badge variant="secondary">{list.total_channels} canais</Badge>
                              <Badge variant={list.status === 'active' ? 'default' : 'outline'}>
                                {list.status}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditList(list);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteList(list.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                    {list.cdn_url && !editingListId && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyUrl(list.cdn_url!);
                        }}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copiar URL
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>

        {/* Coluna 2: Categorias */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Categorias</CardTitle>
                <CardDescription>
                  {selectedList ? `${categories.length} categoria(s)` : 'Selecione uma lista'}
                </CardDescription>
              </div>
              {selectedListId && (
                <div className="flex gap-2">
                  <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="icon">
                        <Upload className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Importar M3U</DialogTitle>
                        <DialogDescription>
                          Você pode importar pela URL (HTTPS recomendado) ou colando o conteúdo do arquivo .m3u
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>URL do arquivo M3U (opcional)</Label>
                          <Input
                            value={importUrl}
                            onChange={(e) => setImportUrl(e.target.value)}
                            placeholder="https://exemplo.com/playlist.m3u"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Conteúdo do arquivo M3U (opcional)</Label>
                          <Textarea
                            value={importContent}
                            onChange={(e) => setImportContent(e.target.value)}
                            placeholder="#EXTM3U\n#EXTINF:-1 tvg-id=..."
                            className="min-h-[160px]"
                          />
                        </div>
                        <Button onClick={handleImportM3U} className="w-full" disabled={isImporting}>
                          <Upload className="h-4 w-4 mr-2" />
                          {isImporting ? (
                            <span className="flex items-center gap-2">
                              <span className="animate-spin">⏳</span>
                              {importProgress || "Importando..."}
                            </span>
                          ) : 'Importar'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  
                  <Dialog open={isNewCategoryDialogOpen} onOpenChange={setIsNewCategoryDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="icon">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Nova Categoria</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Nome Interno</Label>
                          <Input
                            value={newCategoryData.name}
                            onChange={(e) => setNewCategoryData({ ...newCategoryData, name: e.target.value })}
                            placeholder="esportes"
                          />
                        </div>
                        <div>
                          <Label>Nome Exibição</Label>
                          <Input
                            value={newCategoryData.display_name}
                            onChange={(e) => setNewCategoryData({ ...newCategoryData, display_name: e.target.value })}
                            placeholder="Esportes"
                          />
                        </div>
                        <Button onClick={handleCreateCategory} className="w-full">
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {!selectedListId ? (
              <p className="text-sm text-muted-foreground">Selecione uma lista</p>
            ) : categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma categoria</p>
            ) : (
              categories.map((category) => (
                <Card
                  key={category.id}
                  className={`cursor-pointer transition-colors ${
                    selectedCategoryId === category.id ? 'border-primary' : ''
                  }`}
                  onClick={() => setSelectedCategoryId(category.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex justify-between items-center gap-2">
                      {editingCategoryId === category.id ? (
                        <div className="flex-1 flex gap-2">
                          <Input
                            value={editCategoryName}
                            onChange={(e) => setEditCategoryName(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-8"
                          />
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); handleSaveCategoryName(); }}>
                            <Save className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1">
                            <h4 className="font-medium">{category.display_name}</h4>
                            <p className="text-xs text-muted-foreground">{category.name}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">
                              {channels.filter(ch => ch.category_id === category.id).length} canais
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditCategory(category);
                              }}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>

        {/* Coluna 3: Canais */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Canais</CardTitle>
                <CardDescription>
                  {selectedCategory ? `${channels.length} canal(is)` : 'Selecione uma categoria'}
                </CardDescription>
              </div>
              {selectedCategoryId && (
                <Dialog open={isNewChannelDialogOpen} onOpenChange={setIsNewChannelDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="icon">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Novo Canal</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Nome do Canal</Label>
                        <Input
                          value={newChannelData.name}
                          onChange={(e) => setNewChannelData({ ...newChannelData, name: e.target.value })}
                          placeholder="ESPN HD"
                        />
                      </div>
                      <div>
                        <Label>URL do Stream</Label>
                        <Input
                          value={newChannelData.stream_url}
                          onChange={(e) => setNewChannelData({ ...newChannelData, stream_url: e.target.value })}
                          placeholder="http://..."
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>TVG-ID</Label>
                          <Input
                            value={newChannelData.tvg_id}
                            onChange={(e) => setNewChannelData({ ...newChannelData, tvg_id: e.target.value })}
                            placeholder="espn.hd"
                          />
                        </div>
                        <div>
                          <Label>TVG-Name</Label>
                          <Input
                            value={newChannelData.tvg_name}
                            onChange={(e) => setNewChannelData({ ...newChannelData, tvg_name: e.target.value })}
                            placeholder="ESPN HD"
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Logo URL</Label>
                        <Input
                          value={newChannelData.tvg_logo}
                          onChange={(e) => setNewChannelData({ ...newChannelData, tvg_logo: e.target.value })}
                          placeholder="https://..."
                        />
                      </div>
                      <Button onClick={handleCreateChannel} className="w-full">
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Canal
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {!selectedCategoryId ? (
              <p className="text-sm text-muted-foreground">Selecione uma categoria</p>
            ) : channels.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum canal</p>
            ) : (
              channels.map((channel) => (
                <Card key={channel.id}>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      {channel.tvg_logo && (
                        <img
                          src={channel.tvg_logo}
                          alt={channel.name}
                          className="w-12 h-12 rounded object-cover"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        {editingChannelId === channel.id ? (
                          <div className="flex gap-2 mb-2">
                            <Input
                              value={editChannelName}
                              onChange={(e) => setEditChannelName(e.target.value)}
                              className="h-8"
                            />
                            <Button size="sm" onClick={handleSaveChannelName}>
                              <Save className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className="font-medium truncate flex-1">{channel.name}</h4>
                            <div className="flex gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleEditChannel(channel)}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setTransferChannelId(channel.id)}
                              >
                                <ArrowUp className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground truncate">{channel.stream_url}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de transferência de canal */}
      <Dialog open={!!transferChannelId} onOpenChange={() => { setTransferChannelId(null); setTransferToCategoryId(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transferir Canal</DialogTitle>
            <DialogDescription>Selecione a categoria de destino</DialogDescription>
          </DialogHeader>
          <Select value={transferToCategoryId} onValueChange={setTransferToCategoryId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione categoria" />
            </SelectTrigger>
            <SelectContent>
              {categories.filter(c => c.id !== selectedCategoryId).map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleTransferChannel} disabled={!transferToCategoryId}>
            Transferir
          </Button>
        </DialogContent>
      </Dialog>

      {/* Actions */}
      {selectedListId && (
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-2">
              <Button onClick={handleGeneratePreview} variant="outline">
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
              <Button onClick={handleGenerateAndPublish} disabled={isGenerating}>
                <Play className="h-4 w-4 mr-2" />
                {isGenerating ? 'Gerando...' : 'Gerar e Publicar'}
              </Button>
              {selectedList?.cdn_url && (
                <Button onClick={() => handleCopyUrl(selectedList.cdn_url!)} variant="outline">
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar URL CDN
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Preview M3U</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto">
            <pre className="text-xs bg-muted p-4 rounded">{m3uPreview}</pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
