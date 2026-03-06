import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDeliveryActions } from '@/hooks/useDeliveryActions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface DeliveryRow {
  id: string;
  customer_name: string;
  delivery_address: string;
  delivery_fee: number;
  status: string;
  created_at: string;
}

const AdminCancellations = () => {
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [cancelReason, setCancelReason] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { cancelDelivery, loading } = useDeliveryActions();

  useEffect(() => {
    supabase
      .from('deliveries')
      .select('id, customer_name, delivery_address, delivery_fee, status, created_at')
      .in('status', ['searching', 'accepted', 'collecting', 'delivering'])
      .order('created_at', { ascending: false })
      .then(({ data }) => setDeliveries(data ?? []));
  }, []);

  const handleCancel = async () => {
    if (!selectedId) return;
    const ok = await cancelDelivery(selectedId, cancelReason || undefined);
    if (ok) {
      setDeliveries((prev) => prev.filter((d) => d.id !== selectedId));
      setSelectedId(null);
      setCancelReason('');
    }
  };

  const statusLabel: Record<string, string> = {
    searching: 'Buscando', accepted: 'Aceito', collecting: 'Coletando', delivering: 'Entregando',
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Cancelamentos</h1>
      {deliveries.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma entrega ativa</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {deliveries.map((d) => (
            <Card key={d.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="font-semibold">{d.customer_name}</p>
                  <p className="text-sm text-muted-foreground">{d.delivery_address}</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="secondary">{statusLabel[d.status]}</Badge>
                    <span className="text-sm font-medium">R$ {Number(d.delivery_fee).toFixed(2)}</span>
                  </div>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="destructive" onClick={() => setSelectedId(d.id)}>
                      Cancelar
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Cancelar Entrega</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Motivo do cancelamento</Label>
                        <Input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Descreva o motivo..." />
                      </div>
                      <Button variant="destructive" className="w-full" onClick={handleCancel} disabled={loading}>
                        {loading ? 'Cancelando...' : 'Confirmar Cancelamento'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminCancellations;
