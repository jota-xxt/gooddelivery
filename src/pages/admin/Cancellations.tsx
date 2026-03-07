import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDeliveryActions } from '@/hooks/useDeliveryActions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { PackageX, Clock, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DeliveryRow {
  id: string;
  delivery_address: string;
  delivery_fee: number;
  status: string;
  created_at: string;
}

const statusLabel: Record<string, string> = {
  searching: 'Buscando', accepted: 'Aceito', collecting: 'Coletando', delivering: 'Entregando',
};

const getUrgency = (createdAt: string) => {
  const mins = (Date.now() - new Date(createdAt).getTime()) / 60000;
  if (mins > 60) return { label: 'Urgente', color: 'bg-destructive/15 text-destructive' };
  if (mins > 30) return { label: 'Atenção', color: 'bg-warning/15 text-warning' };
  return { label: 'Normal', color: 'bg-muted text-muted-foreground' };
};

const AdminCancellations = () => {
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [cancelReason, setCancelReason] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const { cancelDelivery, loading } = useDeliveryActions();

  useEffect(() => {
    supabase
      .from('deliveries')
      .select('id, delivery_address, delivery_fee, status, created_at')
      .in('status', ['searching', 'accepted', 'collecting', 'delivering'])
      .order('created_at', { ascending: false })
      .then(({ data }) => { setDeliveries(data ?? []); setPageLoading(false); });
  }, []);

  const handleCancel = async () => {
    if (!selectedId) return;
    const ok = await cancelDelivery(selectedId, cancelReason || undefined);
    if (ok) {
      setDeliveries(prev => prev.filter(d => d.id !== selectedId));
      setSelectedId(null);
      setCancelReason('');
    }
  };

  if (pageLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Cancelamentos</h1>
      {deliveries.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="rounded-full bg-success/10 p-4 w-fit mx-auto mb-4">
              <PackageX className="h-8 w-8 text-success" />
            </div>
            <p className="text-lg font-medium">Nenhuma entrega ativa</p>
            <p className="text-sm text-muted-foreground mt-1">Todas as entregas foram concluídas ou já canceladas.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {deliveries.map(d => {
            const urgency = getUrgency(d.created_at);
            return (
              <Card key={d.id} className="hover:shadow-md transition-shadow">
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold truncate">{d.delivery_address}</p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${urgency.color}`}>
                        {urgency.label}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{d.delivery_address}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <Badge variant="secondary">{statusLabel[d.status]}</Badge>
                      <span className="text-sm font-medium">R$ {Number(d.delivery_fee).toFixed(2)}</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(d.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="destructive" onClick={() => setSelectedId(d.id)} className="gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" /> Cancelar
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Cancelar Entrega</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Motivo do cancelamento</Label>
                          <Input value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Descreva o motivo..." />
                        </div>
                        <Button variant="destructive" className="w-full" onClick={handleCancel} disabled={loading}>
                          {loading ? 'Cancelando...' : 'Confirmar Cancelamento'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminCancellations;
