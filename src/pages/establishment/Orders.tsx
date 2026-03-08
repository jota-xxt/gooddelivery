import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, MapPin, Clock, Loader2, User, AlertTriangle, MessageSquare, Package, DollarSign, Truck } from 'lucide-react';
import DeliveryTracker from '@/components/DeliveryTracker';
import QuickStats from '@/components/QuickStats';
import ChatDialog from '@/components/ChatDialog';

interface DeliveryWithDriver {
  id: string;
  delivery_address: string;
  delivery_fee: number;
  status: string;
  observations: string | null;
  urgency: string;
  created_at: string;
  driver_id: string | null;
  driver_name?: string;
}

const EstablishmentOrders = () => {
  const { user } = useAuth();
  const [establishmentId, setEstablishmentId] = useState<string | null>(null);
  const [establishmentName, setEstablishmentName] = useState('');
  const [deliveries, setDeliveries] = useState<DeliveryWithDriver[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  // Today stats
  const [todayStats, setTodayStats] = useState({ active: 0, completed: 0, totalSpent: 0 });

  // Form state
  const [address, setAddress] = useState('');
  const [observations, setObservations] = useState('');
  const [urgency, setUrgency] = useState('normal');
  const [fee, setFee] = useState('');
  const [creating, setCreating] = useState(false);

  // Chat state
  const [chatDeliveryId, setChatDeliveryId] = useState<string | null>(null);
  const [chatDriverName, setChatDriverName] = useState<string | undefined>();
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('establishments').select('id, business_name').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setEstablishmentId(data.id);
          setEstablishmentName(data.business_name);
        }
      });
  }, [user]);

  const fetchDeliveries = useCallback(async () => {
    if (!establishmentId) return;
    const { data } = await supabase
      .from('deliveries')
      .select('id, delivery_address, delivery_fee, status, observations, urgency, created_at, driver_id')
      .eq('establishment_id', establishmentId)
      .in('status', ['searching', 'accepted', 'collecting', 'delivering'])
      .order('created_at', { ascending: false });

    if (data) {
      const driverIds = [...new Set(data.filter(d => d.driver_id).map(d => d.driver_id!))];
      let driverMap = new Map<string, string>();

      if (driverIds.length > 0) {
        const { data: drivers } = await supabase.from('drivers').select('id, user_id').in('id', driverIds);
        if (drivers) {
          const userIds = drivers.map(d => d.user_id);
          const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
          if (profiles) {
            const profileMap = new Map(profiles.map(p => [p.user_id, p.full_name]));
            drivers.forEach(d => { driverMap.set(d.id, profileMap.get(d.user_id) ?? 'Entregador'); });
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

  // Fetch today's stats
  useEffect(() => {
    if (!establishmentId) return;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    supabase.from('deliveries')
      .select('status, delivery_fee')
      .eq('establishment_id', establishmentId)
      .gte('created_at', todayStart.toISOString())
      .then(({ data }) => {
        if (data) {
          const active = data.filter(d => !['completed', 'cancelled'].includes(d.status)).length;
          const completed = data.filter(d => d.status === 'completed').length;
          const totalSpent = data.filter(d => d.status === 'completed').reduce((s, d) => s + Number(d.delivery_fee), 0);
          setTodayStats({ active, completed, totalSpent });
        }
      });
  }, [establishmentId, deliveries]);

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
    const feeNum = Number(fee);
    if (feeNum <= 0) { toast.error('O valor da corrida deve ser maior que zero'); return; }
    if (address.trim().length < 5) { toast.error('Endereço muito curto'); return; }

    setCreating(true);
    const { error } = await supabase.from('deliveries').insert({
      establishment_id: establishmentId,
      customer_name: '',
      delivery_address: address.trim(),
      delivery_fee: feeNum,
      observations: observations.trim() || null,
      urgency,
    });
    setCreating(false);

    if (error) { toast.error('Erro ao criar entrega. Tente novamente.'); return; }

    const { data: newDelivery } = await supabase
      .from('deliveries').select('id').eq('establishment_id', establishmentId)
      .eq('status', 'searching').order('created_at', { ascending: false }).limit(1).maybeSingle();

    if (newDelivery) {
      supabase.functions.invoke('process-delivery-queue', { body: { delivery_id: newDelivery.id } }).catch(() => {});
    }

    toast.success('Entrega solicitada! Buscando entregador...');
    setDialogOpen(false);
    setAddress(''); setObservations(''); setFee(''); setUrgency('normal');
  };

  const statusLabels: Record<string, string> = {
    searching: 'Buscando entregador',
    accepted: 'Entregador a caminho',
    collecting: 'Coletando pedido',
    delivering: 'Em entrega',
  };

  const timeSince = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (diff < 1) return 'agora';
    if (diff < 60) return `${diff}min`;
    return `${Math.floor(diff / 60)}h`;
  };

  const filteredDeliveries = activeTab === 'all'
    ? deliveries
    : activeTab === 'searching'
    ? deliveries.filter(d => d.status === 'searching')
    : deliveries.filter(d => ['accepted', 'collecting', 'delivering'].includes(d.status));

  // Greeting based on time
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground px-4 pt-6 pb-10 rounded-b-3xl">
        <p className="text-sm text-primary-foreground/70">{greeting} 👋</p>
        <h1 className="text-xl font-bold">{establishmentName || 'Carregando...'}</h1>
      </div>

      {/* Stats */}
      <div className="px-4 -mt-6">
        <QuickStats stats={[
          { label: 'Ativos', value: todayStats.active, icon: Package, color: 'bg-warning/10 text-warning' },
          { label: 'Concluídos', value: todayStats.completed, icon: Truck, color: 'bg-success/10 text-success' },
          { label: 'Gasto Hoje', value: `R$${todayStats.totalSpent.toFixed(0)}`, icon: DollarSign, color: 'bg-primary/10 text-primary' },
        ]} />
      </div>

      <div className="p-4 space-y-4">
        {/* Filter Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1">Todos ({deliveries.length})</TabsTrigger>
            <TabsTrigger value="searching" className="flex-1">Buscando ({deliveries.filter(d => d.status === 'searching').length})</TabsTrigger>
            <TabsTrigger value="active" className="flex-1">Em andamento ({deliveries.filter(d => d.status !== 'searching').length})</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredDeliveries.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-2 text-muted-foreground/50" />
              <p>Nenhum pedido ativo</p>
              <p className="text-xs mt-1">Toque no + para solicitar um entregador</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredDeliveries.map((d) => (
              <Card
                key={d.id}
                className={`overflow-hidden transition-all ${
                  d.urgency === 'urgent' ? 'border-destructive/50 shadow-sm shadow-destructive/10' : ''
                } ${d.status === 'searching' ? 'animate-pulse-subtle' : ''}`}
              >
                <CardContent className="py-4 space-y-3">
                  {/* Top: badges + time */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {d.urgency === 'urgent' && (
                        <Badge variant="destructive" className="text-[10px] px-2 py-0.5">
                          <AlertTriangle className="h-3 w-3 mr-1" /> Urgente
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-[10px]">{statusLabels[d.status]}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {timeSince(d.created_at)}
                    </span>
                  </div>

                  {/* Address */}
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-sm font-medium">{d.delivery_address}</p>
                  </div>

                  {/* Observations */}
                  {d.observations && (
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span className="text-xs">{d.observations}</span>
                    </div>
                  )}

                  {/* Driver info + fee */}
                  <div className="flex items-center justify-between">
                    {d.driver_name ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                            {d.driver_name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-medium">{d.driver_name}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Aguardando entregador...</span>
                    )}
                    <span className="text-sm font-bold text-primary">R$ {Number(d.delivery_fee).toFixed(2)}</span>
                  </div>

                  {/* Delivery Tracker */}
                  <DeliveryTracker status={d.status} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <Button
        onClick={() => setDialogOpen(true)}
        className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg shadow-primary/30 z-50 p-0"
        size="icon"
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Solicitar Entrega</DialogTitle></DialogHeader>
          <form onSubmit={createDelivery} className="space-y-4">
            <div className="space-y-2">
              <Label>Endereço de entrega *</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Ex: Rua das Flores, 123 - Centro" required minLength={5} />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={observations} onChange={(e) => setObservations(e.target.value)} placeholder="Ex: Entregar na portaria, apto 302" rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Valor da corrida (R$) *</Label>
              <Input type="number" step="0.50" min="1" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="Ex: 8.00" required />
            </div>
            <div className="space-y-2">
              <Label>Urgência</Label>
              <Select value={urgency} onValueChange={setUrgency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={creating}>
              {creating ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Solicitando...</> : 'Solicitar Entregador'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EstablishmentOrders;
