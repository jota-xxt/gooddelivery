import { useEffect, useState, useCallback } from 'react';
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
import { Plus, MapPin, Clock, Loader2, User } from 'lucide-react';

interface DeliveryWithDriver {
  id: string;
  customer_name: string;
  delivery_address: string;
  delivery_fee: number;
  status: string;
  prep_time_minutes: number;
  created_at: string;
  driver_id: string | null;
  driver_name?: string;
}

const EstablishmentOrders = () => {
  const { user } = useAuth();
  const [establishmentId, setEstablishmentId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryWithDriver[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [prepTime, setPrepTime] = useState('15');
  const [fee, setFee] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('establishments').select('id').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { if (data) setEstablishmentId(data.id); });
  }, [user]);

  const fetchDeliveries = useCallback(async () => {
    if (!establishmentId) return;
    const { data } = await supabase
      .from('deliveries')
      .select('id, customer_name, delivery_address, delivery_fee, status, prep_time_minutes, created_at, driver_id')
      .eq('establishment_id', establishmentId)
      .in('status', ['searching', 'accepted', 'collecting', 'delivering'])
      .order('created_at', { ascending: false });

    if (data) {
      // Enrich with driver names
      const driverIds = [...new Set(data.filter(d => d.driver_id).map(d => d.driver_id!))];
      let driverMap = new Map<string, string>();

      if (driverIds.length > 0) {
        const { data: drivers } = await supabase
          .from('drivers')
          .select('id, user_id')
          .in('id', driverIds);

        if (drivers) {
          const userIds = drivers.map(d => d.user_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, full_name')
            .in('user_id', userIds);

          if (profiles) {
            const profileMap = new Map(profiles.map(p => [p.user_id, p.full_name]));
            drivers.forEach(d => {
              driverMap.set(d.id, profileMap.get(d.user_id) ?? 'Entregador');
            });
          }
        }
      }

      setDeliveries(data.map(d => ({
        ...d,
        driver_name: d.driver_id ? driverMap.get(d.driver_id) : undefined,
      })));
    }
    setLoading(false);
  }, [establishmentId]);

  useEffect(() => {
    fetchDeliveries();

    if (!establishmentId) return;
    const channel = supabase
      .channel('est-deliveries')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, fetchDeliveries)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [establishmentId, fetchDeliveries]);

  const createDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!establishmentId) return;

    // Validations
    const feeNum = Number(fee);
    if (feeNum <= 0) { toast.error('O valor da corrida deve ser maior que zero'); return; }
    if (customerName.trim().length < 2) { toast.error('Nome do cliente inválido'); return; }
    if (address.trim().length < 5) { toast.error('Endereço muito curto'); return; }

    setCreating(true);
    const { error } = await supabase.from('deliveries').insert({
      establishment_id: establishmentId,
      customer_name: customerName.trim(),
      delivery_address: address.trim(),
      prep_time_minutes: Number(prepTime),
      delivery_fee: feeNum,
    });
    setCreating(false);

    if (error) {
      toast.error('Erro ao criar entrega. Tente novamente.');
      return;
    }

    // Trigger queue processing if in queue mode
    // Get the newly created delivery ID from the latest searching delivery
    const { data: newDelivery } = await supabase
      .from('deliveries')
      .select('id')
      .eq('establishment_id', establishmentId)
      .eq('status', 'searching')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (newDelivery) {
      supabase.functions.invoke('process-delivery-queue', {
        body: { delivery_id: newDelivery.id },
      }).catch(() => {}); // Fire and forget - queue processing is best-effort
    }

    toast.success('Entrega solicitada! Buscando entregador...');
    setDialogOpen(false);
    setCustomerName('');
    setAddress('');
    setFee('');
    setPrepTime('15');
  };

  const statusLabels: Record<string, string> = {
    searching: 'Buscando entregador',
    accepted: 'Entregador a caminho',
    collecting: 'Coletando pedido',
    delivering: 'Em entrega',
  };

  const statusColors: Record<string, string> = {
    searching: 'bg-warning text-warning-foreground',
    accepted: 'bg-primary text-primary-foreground',
    collecting: 'bg-primary text-primary-foreground',
    delivering: 'bg-success text-success-foreground',
  };

  const timeSince = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (diff < 1) return 'agora';
    if (diff < 60) return `${diff} min atrás`;
    return `${Math.floor(diff / 60)}h atrás`;
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
                <Label>Nome do cliente *</Label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ex: João Silva"
                  required
                  minLength={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Endereço de entrega *</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ex: Rua das Flores, 123 - Centro"
                  required
                  minLength={5}
                />
              </div>
              <div className="space-y-2">
                <Label>Tempo de preparo</Label>
                <Select value={prepTime} onValueChange={setPrepTime}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutos</SelectItem>
                    <SelectItem value="30">30 minutos</SelectItem>
                    <SelectItem value="45">45 minutos</SelectItem>
                    <SelectItem value="60">60 minutos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor da corrida (R$) *</Label>
                <Input
                  type="number"
                  step="0.50"
                  min="1"
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                  placeholder="Ex: 8.00"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={creating}>
                {creating ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Solicitando...</> : 'Solicitar Entregador'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : deliveries.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>Nenhum pedido ativo</p>
            <p className="text-xs mt-1">Clique em "Nova Entrega" para solicitar um entregador</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {deliveries.map((d) => (
            <Card key={d.id} className={d.status === 'searching' ? 'border-warning/50' : ''}>
              <CardContent className="py-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{d.customer_name}</p>
                  <Badge className={statusColors[d.status]}>{statusLabels[d.status]}</Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {d.delivery_address}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">R$ {Number(d.delivery_fee).toFixed(2)}</span>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    {d.driver_name && (
                      <span className="flex items-center gap-1 text-xs">
                        <User className="h-3 w-3" />
                        {d.driver_name}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs">
                      <Clock className="h-3 w-3" />
                      {timeSince(d.created_at)}
                    </span>
                  </div>
                </div>

                {/* Status stepper */}
                <div className="flex items-center gap-1 pt-1">
                  {['searching', 'accepted', 'collecting', 'delivering'].map((step, i) => {
                    const steps = ['searching', 'accepted', 'collecting', 'delivering'];
                    const currentIdx = steps.indexOf(d.status);
                    return (
                      <div
                        key={step}
                        className={`h-1.5 flex-1 rounded-full ${
                          i <= currentIdx ? 'bg-primary' : 'bg-muted'
                        }`}
                      />
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default EstablishmentOrders;
