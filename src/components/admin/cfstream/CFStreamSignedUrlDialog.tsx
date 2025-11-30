/**
 * CFStreamSignedUrlDialog - Modal para gerar e copiar URLs assinadas
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Copy, 
  Check, 
  Loader2, 
  Play, 
  Clock,
  Link2,
  Shield
} from "lucide-react";
import { toast } from "sonner";
import { getSignedPlaybackUrl, SignedPlaybackUrl } from "@/services/cloudflareStreamService";

interface CFStreamSignedUrlDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cfStreamUid: string;
  channelName?: string;
}

const expirationOptions = [
  { value: "1800", label: "30 minutos" },
  { value: "3600", label: "1 hora" },
  { value: "7200", label: "2 horas" },
  { value: "14400", label: "4 horas" },
  { value: "86400", label: "24 horas" },
];

export function CFStreamSignedUrlDialog({
  open,
  onOpenChange,
  cfStreamUid,
  channelName,
}: CFStreamSignedUrlDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [expiresIn, setExpiresIn] = useState("3600");
  const [signedUrl, setSignedUrl] = useState<SignedPlaybackUrl | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerateUrl = async () => {
    setIsLoading(true);
    try {
      const result = await getSignedPlaybackUrl(cfStreamUid, parseInt(expiresIn));
      if (result) {
        setSignedUrl(result);
        toast.success(result.signed ? "URL assinada gerada!" : "URL gerada (sem assinatura)");
      } else {
        toast.error("Falha ao gerar URL");
      }
    } catch (error) {
      console.error("Error generating signed URL:", error);
      toast.error("Erro ao gerar URL assinada");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!signedUrl?.url) return;
    
    try {
      await navigator.clipboard.writeText(signedUrl.url);
      setCopied(true);
      toast.success("URL copiada!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Falha ao copiar");
    }
  };

  const handlePreview = () => {
    if (!signedUrl?.url) return;
    window.open(signedUrl.url, "_blank");
  };

  const formatExpiration = (expiresAt: number) => {
    const date = new Date(expiresAt * 1000);
    return date.toLocaleString("pt-BR");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            URL Assinada
          </DialogTitle>
          <DialogDescription>
            Gere uma URL assinada temporária para playback seguro
            {channelName && (
              <span className="block mt-1 font-medium text-foreground">
                {channelName}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* UID Info */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <Label className="text-xs text-muted-foreground">Stream UID</Label>
            <p className="font-mono text-sm truncate">{cfStreamUid}</p>
          </div>

          {/* Expiration Selection */}
          <div className="space-y-2">
            <Label>Tempo de expiração</Label>
            <Select value={expiresIn} onValueChange={setExpiresIn}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {expirationOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Generate Button */}
          <Button 
            onClick={handleGenerateUrl} 
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Link2 className="h-4 w-4 mr-2" />
                Gerar URL Assinada
              </>
            )}
          </Button>

          {/* Generated URL */}
          {signedUrl && (
            <div className="space-y-3 p-4 border rounded-lg bg-card">
              <div className="flex items-center justify-between">
                <Badge variant={signedUrl.signed ? "default" : "secondary"}>
                  {signedUrl.signed ? "Assinada" : "Não assinada"}
                </Badge>
                {signedUrl.expiresAt && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Expira: {formatExpiration(signedUrl.expiresAt)}
                  </div>
                )}
              </div>

              <div className="relative">
                <Input 
                  value={signedUrl.url} 
                  readOnly 
                  className="pr-20 font-mono text-xs"
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={handleCopy}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar URL
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={handlePreview}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Testar Playback
                </Button>
              </div>

              {!signedUrl.signed && (
                <p className="text-xs text-amber-500">
                  ⚠️ A chave de assinatura não está configurada. Configure o secret CLOUDFLARE_STREAM_SIGNING_KEY para URLs assinadas.
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
