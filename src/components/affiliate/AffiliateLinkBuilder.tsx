import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Check, ExternalLink, Link2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  affiliateId: string;
  customSlug?: string;
}

export function AffiliateLinkBuilder({ affiliateId, customSlug }: Props) {
  const [baseUrl, setBaseUrl] = useState('');
  const [utmSource, setUtmSource] = useState('');
  const [utmMedium, setUtmMedium] = useState('');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  const buildLink = () => {
    const params = new URLSearchParams();
    params.set('ref', customSlug || affiliateId);
    
    if (utmSource) params.set('utm_source', utmSource);
    if (utmMedium) params.set('utm_medium', utmMedium);
    if (utmCampaign) params.set('utm_campaign', utmCampaign);

    return `${baseUrl}/checkout?${params.toString()}`;
  };

  const shortLink = customSlug 
    ? `${baseUrl}/ref/${customSlug}`
    : buildLink();

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const presets = [
    { label: 'Instagram', source: 'instagram', medium: 'social' },
    { label: 'WhatsApp', source: 'whatsapp', medium: 'chat' },
    { label: 'E-mail', source: 'email', medium: 'email' },
    { label: 'YouTube', source: 'youtube', medium: 'video' },
    { label: 'Facebook', source: 'facebook', medium: 'social' }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Link2 className="h-5 w-5" />
            Seu Link de Afiliado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">Link Principal</p>
            <div className="flex gap-2">
              <Input value={shortLink} readOnly className="font-mono text-sm" />
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => copyToClipboard(shortLink)}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => window.open(shortLink, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {customSlug && (
            <p className="text-sm text-muted-foreground">
              Seu link personalizado: <code className="bg-muted px-2 py-0.5 rounded">/ref/{customSlug}</code>
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Construtor de Link com UTM</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground mr-2">Presets:</span>
            {presets.map(preset => (
              <Button
                key={preset.label}
                variant="outline"
                size="sm"
                onClick={() => {
                  setUtmSource(preset.source);
                  setUtmMedium(preset.medium);
                }}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>UTM Source</Label>
              <Input
                value={utmSource}
                onChange={e => setUtmSource(e.target.value)}
                placeholder="ex: instagram, google"
              />
            </div>
            <div className="space-y-2">
              <Label>UTM Medium</Label>
              <Input
                value={utmMedium}
                onChange={e => setUtmMedium(e.target.value)}
                placeholder="ex: social, email, cpc"
              />
            </div>
            <div className="space-y-2">
              <Label>UTM Campaign</Label>
              <Input
                value={utmCampaign}
                onChange={e => setUtmCampaign(e.target.value)}
                placeholder="ex: black_friday"
              />
            </div>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">Link Gerado</p>
            <div className="flex gap-2">
              <Input 
                value={buildLink()} 
                readOnly 
                className="font-mono text-xs"
              />
              <Button 
                variant="outline"
                onClick={() => copyToClipboard(buildLink())}
              >
                <Copy className="h-4 w-4 mr-1" />
                Copiar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
