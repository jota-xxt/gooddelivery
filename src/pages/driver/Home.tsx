import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { MapPin, DollarSign, Navigation } from 'lucide-react';

interface Delivery {
  id: string;
  customer_name: string;
  delivery_address: string;
  delivery_fee: number;
  status: string;
  prep_time_minutes: number;
  establishment_name?: string;
  establishment_address?: string;
}

const DriverHome = () => {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [availableDeliveries, setAvailableDeliveries] = useState<Delivery[]>([]);
  const [activeDelivery, setActiveDelivery] = useState<Delivery | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from('drivers').select('id, is_online').eq('user_id', user.id).single()
      .then(({ data }) => {
        if (data) {
          setDriverId(data.id);
          setIsOnline(data.is_online);
        }
      });
  }, [user]);

  // Fetch available deliveries and active delivery
  useEffect(() => {
    if (!driverId) return;

    const fetchDeliveries = async () => {
      // Active delivery
      const { data: active } = await supabase
        .from('deliveries')
        .select('id, customer_name, delivery_address, delivery_fee, status, prep_time_minutes, establishment_id')
        .eq('driver_id', driverId)
        .in('status', ['accepted', 'collecting', 'delivering'])
        .single();

      if (active) {
        const { data: est } = await supabase.from('establishments').select('business_name, address').eq('id', active.establishment_id).single();
        setActiveDelivery({ ...active, establishment_name: est?.business_name, establishment_address: est?.address });
        setAvailableDeliveries([]);
        return;
      }
      setActiveDelivery(null);

      // Pool deliveries
      if (isOnline) {
        const { data: pool } = await supabase
          .from('deliveries')
          .select('id, customer_name, delivery_address, delivery_fee, status, prep_time_minutes, establishment_id')
          .eq('status', 'searching')
          .order('created_at', { ascending: false });

        if (pool) {
          const enriched = await Promise.all(pool.map(async (d) => {
            const { data: est } = await supabase.from('establishments').select('business_name, address').eq('id', d.establishment_id).single();
            return { ...d, establishment_name: est?.business_name, establishment_address: est?.address };
          }));
          setAvailableDeliveries(enriched);
        }
      }
    };

    fetchDeliveries();

    // Realtime subscription
    const channel = supabase
      .channel('deliveries-pool')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, () => {
        fetchDeliveries();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [driverId, isOnline]);

  const toggleOnline = async () => {
    if (!driverId) return;
    const newStatus = !isOnline;
    await supabase.from('drivers').update({ is_online: newStatus }).eq('id', driverId);
    setIsOnline(newStatus);
    toast.success(newStatus ? 'Você está online!' : 'Você está offline');
  };

  const acceptDelivery = async (deliveryId: string) => {
    if (!driverId) return;
    const { error } = await supabase
      .from('deliveries')
      .update({ driver_id: driverId, status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', deliveryId)
      .eq('status', 'searching');
    if (error) { toast.error('Não foi possível aceitar. Talvez outro entregador já aceitou.'); return; }
    toast.success('Corrida aceita!');
  };

  const advanceStatus = async () => {
    if (!activeDelivery) return;
    const next: Record<string, { status: string; field?: string }> = {
      accepted: { status: 'collecting', field: 'collected_at' },
      collecting: { status: 'delivering' },
      delivering: { status: 'completed', field: 'delivered_at' },
    };
    const n = next[activeDelivery.status];
    if (!n) return;

    const update: Record<string, string> = { status: n.status };
    if (n.field) update[n.field] = new Date().toISOString();

    await supabase.from('deliveries').update(update).eq('id', activeDelivery.id);
    if (n.status === 'completed') toast.success('Entrega concluída! 🎉');
  };

  const statusActions: Record<string, string> = {
    accepted: 'Cheguei no estabelecimento',
    collecting: 'Saí para entrega',
    delivering: 'Entrega concluída',
  };

  const openMaps = (address: string) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, '_blank');
  };

  return (
    <div className="p-4 space-y-6">
      {/* Online toggle */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div>
            <p className="font-semibold">Status</p>
            <p className="text-sm text-muted-foreground">{isOnline ? 'Online - recebendo corridas' : 'Offline'}</p>
          </div>
          <Switch checked={isOnline} onCheckedChange={toggleOnline} />
        </CardContent>
      </Card>

      {/* Active delivery */}
      {activeDelivery && (
        <Card className="border-primary border-2">
          <CardContent className="py-4 space-y-4">
            <div className="flex items-center justify-between">
              <Badge className="bg-primary text-primary-foreground">
                {activeDelivery.status === 'accepted' ? 'Aceito' : activeDelivery.status === 'collecting' ? 'Coletando' : 'Entregando'}
              </Badge>
              <span className="font-bold text-lg">R$ {Number(activeDelivery.delivery_fee).toFixed(2)}</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Coleta</p>
                  <p className="text-sm font-medium">{activeDelivery.establishment_name}</p>
                  <p className="text-xs text-muted-foreground">{activeDelivery.establishment_address}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-success mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Entrega</p>
                  <p className="text-sm font-medium">{activeDelivery.customer_name}</p>
                  <p className="text-xs text-muted-foreground">{activeDelivery.delivery_address}</p>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1 font-semibold" onClick={advanceStatus}>
                {statusActions[activeDelivery.status]}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => openMaps(
                  activeDelivery.status === 'accepted' || activeDelivery.status === 'collecting'
                    ? activeDelivery.establishment_address ?? ''
                    : activeDelivery.delivery_address
                )}
              >
                <Navigation className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available deliveries pool */}
      {!activeDelivery && isOnline && (
        <div className="space-y-3">
          <h2 className="font-semibold text-lg">Corridas Disponíveis</h2>
          {availableDeliveries.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma corrida disponível no momento</CardContent></Card>
          ) : (
            availableDeliveries.map((d) => (
              <Card key={d.id} className="border border-border hover:border-primary transition-colors">
                <CardContent className="py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-lg flex items-center gap-1">
                      <DollarSign className="h-4 w-4 text-primary" />
                      R$ {Number(d.delivery_fee).toFixed(2)}
                    </span>
                    <Badge variant="secondary">{d.prep_time_minutes} min preparo</Badge>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>{d.establishment_name} — {d.establishment_address}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-3.5 w-3.5 text-success shrink-0" />
                      <span>{d.customer_name} — {d.delivery_address}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1 font-semibold" onClick={() => acceptDelivery(d.id)}>Aceitar</Button>
                    <Button variant="outline" className="flex-1">Recusar</Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {!activeDelivery && !isOnline && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg">Fique online para receber corridas</p>
        </div>
      )}
    </div>
  );
};

export default DriverHome;
