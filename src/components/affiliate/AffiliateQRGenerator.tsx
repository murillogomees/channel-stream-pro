import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, QrCode } from 'lucide-react';
import QRCode from 'qrcode';

interface Props {
  affiliateId: string;
  customSlug?: string;
}

export function AffiliateQRGenerator({ affiliateId, customSlug }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [size, setSize] = useState(256);
  const [color, setColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#ffffff');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const affiliateLink = customSlug 
    ? `${window.location.origin}/ref/${customSlug}`
    : `${window.location.origin}/checkout?ref=${affiliateId}`;

  useEffect(() => {
    generateQR();
  }, [affiliateLink, size, color, bgColor]);

  const generateQR = async () => {
    try {
      const dataUrl = await QRCode.toDataURL(affiliateLink, {
        width: size,
        margin: 2,
        color: {
          dark: color,
          light: bgColor
        }
      });
      setQrDataUrl(dataUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  const downloadQR = () => {
    if (qrDataUrl) {
      const link = document.createElement('a');
      link.download = `qrcode-afiliado-${customSlug || affiliateId}.png`;
      link.href = qrDataUrl;
      link.click();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <QrCode className="h-5 w-5" />
          QR Code do Link
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* QR Preview */}
          <div className="flex-shrink-0">
            <div 
              className="border rounded-lg p-4 inline-block"
              style={{ backgroundColor: bgColor }}
            >
              {qrDataUrl && (
                <img 
                  src={qrDataUrl} 
                  alt="QR Code" 
                  width={size > 300 ? 300 : size}
                  height={size > 300 ? 300 : size}
                />
              )}
            </div>
          </div>

          {/* Customization */}
          <div className="flex-1 space-y-4">
            <div className="space-y-2">
              <Label>Tamanho (px)</Label>
              <Input
                type="number"
                value={size}
                onChange={e => setSize(Number(e.target.value))}
                min={128}
                max={512}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cor do QR</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={color}
                    onChange={e => setColor(e.target.value)}
                    className="w-12 h-9 p-1"
                  />
                  <Input
                    value={color}
                    onChange={e => setColor(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Cor de Fundo</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={bgColor}
                    onChange={e => setBgColor(e.target.value)}
                    className="w-12 h-9 p-1"
                  />
                  <Input
                    value={bgColor}
                    onChange={e => setBgColor(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4">
              <Button onClick={downloadQR} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Download QR Code
              </Button>
            </div>
          </div>
        </div>

        <div className="p-3 bg-muted rounded-lg">
          <p className="text-xs text-muted-foreground mb-1">Link codificado:</p>
          <code className="text-xs break-all">{affiliateLink}</code>
        </div>
      </CardContent>
    </Card>
  );
}
