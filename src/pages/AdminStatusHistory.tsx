import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, History, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusChangeTimeline } from '@/components/admin/StatusChangeTimeline';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function AdminStatusHistory() {
  const navigate = useNavigate();
  const [selectedService, setSelectedService] = useState<string>('all');
  const [limit, setLimit] = useState<number>(50);

  const services = [
    { value: 'all', label: 'Todos os Serviços' },
    { value: 'supabase', label: 'Supabase' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'smartone', label: 'SmartOne' },
    { value: 'websocket', label: 'WebSocket' },
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/admin/dashboard')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <History className="h-8 w-8 text-primary" />
                Histórico de Status
              </h1>
              <p className="text-muted-foreground">
                Acompanhe todas as mudanças de status dos serviços
              </p>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
            <CardDescription>
              Filtre o histórico por serviço e quantidade de registros
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Serviço</label>
                <Select value={selectedService} onValueChange={setSelectedService}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((service) => (
                      <SelectItem key={service.value} value={service.value}>
                        {service.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Registros</label>
                <Select value={limit.toString()} onValueChange={(v) => setLimit(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">Últimos 25</SelectItem>
                    <SelectItem value="50">Últimos 50</SelectItem>
                    <SelectItem value="100">Últimos 100</SelectItem>
                    <SelectItem value="200">Últimos 200</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        <StatusChangeTimeline
          serviceName={selectedService === 'all' ? undefined : selectedService}
          limit={limit}
          showServiceName={selectedService === 'all'}
        />
      </div>
    </div>
  );
}
