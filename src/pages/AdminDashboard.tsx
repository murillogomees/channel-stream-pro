import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, Trash2, Download, Settings, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const AdminDashboard = () => {
  const [m3uLists, setM3uLists] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
    loadM3uLists();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/admin/login');
      return;
    }

    const { data: adminData } = await supabase
      .from('admins')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!adminData) {
      navigate('/admin/login');
    }
  };

  const loadM3uLists = async () => {
    try {
      const { data, error } = await supabase
        .from('m3u_lists')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setM3uLists(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar listas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.m3u') && !file.name.toLowerCase().endsWith('.m3u8')) {
      toast({
        title: "Arquivo inválido",
        description: "Apenas arquivos .m3u ou .m3u8 são permitidos",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const fileName = `${Date.now()}-${file.name}`;
      
      // Upload para storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('m3u-files')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Obter URL do arquivo
      const { data: urlData } = supabase.storage
        .from('m3u-files')
        .getPublicUrl(fileName);

      // Salvar no banco
      const { data: { user } } = await supabase.auth.getUser();
      const { error: dbError } = await supabase
        .from('m3u_lists')
        .insert({
          name: file.name,
          filename: fileName,
          file_url: urlData.publicUrl,
          file_size: file.size,
          uploaded_by: user?.id,
        });

      if (dbError) throw dbError;

      toast({
        title: "Upload realizado com sucesso",
        description: `Arquivo ${file.name} foi carregado`,
      });

      loadM3uLists();
    } catch (error: any) {
      toast({
        title: "Erro no upload",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const deleteList = async (id: string, filename: string) => {
    try {
      // Deletar arquivo do storage
      await supabase.storage.from('m3u-files').remove([filename]);

      // Deletar do banco
      const { error } = await supabase
        .from('m3u_lists')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Lista deletada",
        description: "Arquivo removido com sucesso",
      });

      loadM3uLists();
    } catch (error: any) {
      toast({
        title: "Erro ao deletar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gradient-primary">Painel Administrativo</h1>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>

        <div className="grid gap-6">
          {/* Upload Section */}
          <Card className="bg-gradient-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload de Listas M3U
              </CardTitle>
              <CardDescription>
                Faça upload de arquivos .m3u ou .m3u8 para atualizar os canais
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="m3u-file" className="cursor-pointer">
                    <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-smooth">
                      <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-lg font-medium mb-2">Clique para selecionar arquivo</p>
                      <p className="text-sm text-muted-foreground">
                        Apenas arquivos .m3u ou .m3u8 (máx. 50MB)
                      </p>
                    </div>
                    <Input
                      id="m3u-file"
                      type="file"
                      accept=".m3u,.m3u8"
                      onChange={handleFileUpload}
                      disabled={uploading}
                      className="hidden"
                    />
                  </Label>
                </div>
                {uploading && (
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-2 text-sm text-muted-foreground">Fazendo upload...</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Lists Section */}
          <Card className="bg-gradient-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Listas Carregadas ({m3uLists.length})
              </CardTitle>
              <CardDescription>
                Gerencie suas listas M3U carregadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {m3uLists.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma lista carregada ainda
                </div>
              ) : (
                <div className="space-y-4">
                  {m3uLists.map((list) => (
                    <div
                      key={list.id}
                      className="flex items-center justify-between p-4 border border-border rounded-lg bg-card"
                    >
                      <div className="flex-1">
                        <h3 className="font-medium text-foreground">{list.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {(list.file_size / 1024 / 1024).toFixed(2)} MB • 
                          {new Date(list.created_at).toLocaleDateString('pt-BR')}
                        </p>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          list.status === 'active' 
                            ? 'bg-primary/10 text-primary' 
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {list.status === 'active' ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(list.file_url, '_blank')}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteList(list.id, list.filename)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;