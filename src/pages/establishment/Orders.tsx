import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, MapPin } from 'lucide-react';

interface Delivery {
  id: string;
  customer_name: string;
  delivery_address: string;
  delivery_fee: number;
  status: string;
  prep_time_minutes: number;
  created_at: string;
}

const EstablishmentOrders = () => {
  const { user } = useAuth();
  const [establishmentId, setEstablishmentId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  // New delivery form
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [prepTime, setPrepTime] = useState('15');
  const [fee, setFee] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('establishments').select('id').eq('user_id', user.id).single()
      .then(({ data }) => { if (data) setEstablishmentId(data.id); });
  }, [user]);

  const fetchDeliveries = async () => {
    if (!establishmentId) return;
    const { data } = await supabase
      .from('deliveries')
      .select('id, customer_name, delivery_address, delivery_fee, status, prep_time_minutes, created_at')
      .eq('establishment_id', establishmentId)
      .in('status', ['searching', 'accepted', 'collecting', 'delivering'])
      .order('created_at', { ascending: false });
    setDeliveries(data ?? []);
  };

  useEffect(() => {
    fetchDeliveries();

    if (!establishmentId) return;
    const channel = supabase
      .channel('est-deliveries')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, fetchDeliveries)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [establishmentId]);

  const createDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!establishmentId) return;
    setCreating(true);
    const { error } = await supabase.from('deliveries').insert({
      establishment_id: establishmentId,
      customer_name: customerName,
      delivery_address: address,
      prep_time_minutes: Number(prepTime),
      delivery_fee: Number(fee),
    });
    setCreating(false);
    if (error) { toast.error('Erro ao criar entrega'); return; }
    toast.success('Entrega solicitada!');
    setDialogOpen(false);
    setCustomerName(''); setAddress(''); setFee(''); setPrepTime('15');
  };

  const statusLabels: Record<string, string> = {
    searching: 'Buscando entregador', accepted: 'Aceito', collecting: 'Coletando', delivering: 'Em entrega',
  };
  const statusColors: Record<string, string> = {
    searching: 'bg-warning text-warning-foreground', accepted: 'bg-primary text-primary-foreground',
    collecting: 'bg-primary text-primary-foreground', delivering: 'bg-success text-success-foreground',
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pedidos</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Entrega</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Solicitar Entrega</DialogTitle></DialogHeader>
            <form onSubmit={createDelivery} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do cliente</Label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Endereço de entrega</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Tempo de preparo</Label>
                <Select value={prepTime} onValueChange={setPrepTime}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutos</SelectItem>
                    <SelectItem value="30">30 minutos</SelectItem>
                    <SelectItem value="45">45 minutos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor da corrida (R$)</Label>
                <Input type="number" step="0.01" min="0" value={fee} onChange={(e) => setFee(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={creating}>
                {creating ? 'Solicitando...' : 'Solicitar Entregador'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {deliveries.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum pedido ativo</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {deliveries.map((d) => (
            <Card key={d.id}>
              <CardContent className="py-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{d.customer_name}</p>
                  <Badge className={statusColors[d.status]}>{statusLabels[d.status]}</Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {d.delivery_address}
                </div>
                <p className="text-sm font-medium">R$ {Number(d.delivery_fee).toFixed(2)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default EstablishmentOrders;
