import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDeliveryActions } from '@/hooks/useDeliveryActions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { MapPin, DollarSign, Navigation, Clock, Loader2, CheckCircle2 } from 'lucide-react';

interface DeliveryWithEstablishment {
  id: string;
  customer_name: string;
  delivery_address: string;
  delivery_fee: number;
  status: string;
  prep_time_minutes: number;
  establishment_id: string;
  created_at: string;
  establishment_name?: string;
  establishment_address?: string;
}

const DriverHome = () => {
  const { user } = useAuth();
  const { acceptDelivery, advanceDelivery, loading: actionLoading } = useDeliveryActions();
  const [isOnline, setIsOnline] = useState(false);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [availableDeliveries, setAvailableDeliveries] = useState<DeliveryWithEstablishment[]>([]);
  const [activeDelivery, setActiveDelivery] = useState<DeliveryWithEstablishment | null>(null);
  const [togglingOnline, setTogglingOnline] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from('drivers').select('id, is_online').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setDriverId(data.id);
          setIsOnline(data.is_online);
        }
        setInitialLoading(false);
      });
  }, [user]);

  const fetchDeliveries = useCallback(async () => {
    if (!driverId) return;

    // Active delivery first
    const { data: active } = await supabase
      .from('deliveries')
      .select('id, customer_name, delivery_address, delivery_fee, status, prep_time_minutes, establishment_id, created_at')
      .eq('driver_id', driverId)
      .in('status', ['accepted', 'collecting', 'delivering'])
      .limit(1)
      .maybeSingle();

    if (active) {
      const { data: est } = await supabase.from('establishments').select('business_name, address').eq('id', active.establishment_id).maybeSingle();
      setActiveDelivery({ ...active, establishment_name: est?.business_name, establishment_address: est?.address });
      setAvailableDeliveries([]);
      return;
    }
    setActiveDelivery(null);

    // Pool — only when online
    if (isOnline) {
      const { data: pool } = await supabase
        .from('deliveries')
        .select('id, customer_name, delivery_address, delivery_fee, status, prep_time_minutes, establishment_id, created_at')
        .eq('status', 'searching')
        .order('created_at', { ascending: false })
        .limit(20);

      if (pool && pool.length > 0) {
        const estIds = [...new Set(pool.map(d => d.establishment_id))];
        const { data: establishments } = await supabase
          .from('establishments')
          .select('id, business_name, address')
          .in('id', estIds);

        const estMap = new Map(establishments?.map(e => [e.id, e]) ?? []);
        const enriched = pool.map(d => ({
          ...d,
          establishment_name: estMap.get(d.establishment_id)?.business_name,
          establishment_address: estMap.get(d.establishment_id)?.address,
        }));
        setAvailableDeliveries(enriched);
      } else {
        setAvailableDeliveries([]);
      }
    } else {
      setAvailableDeliveries([]);
    }
  }, [driverId, isOnline]);

  useEffect(() => {
    fetchDeliveries();

    if (!driverId) return;
    const channel = supabase
      .channel('deliveries-pool')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, () => {
        fetchDeliveries();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [driverId, isOnline, fetchDeliveries]);

  const toggleOnline = async () => {
    if (!driverId || togglingOnline) return;

    // Don't allow going offline with active delivery
    if (isOnline && activeDelivery) {
      toast.error('Finalize a corrida ativa antes de ficar offline');
      return;
    }

    setTogglingOnline(true);
    const newStatus = !isOnline;
    const { error } = await supabase.from('drivers').update({ is_online: newStatus }).eq('id', driverId);
    setTogglingOnline(false);

    if (error) {
      toast.error('Erro ao alterar status');
      return;
    }

    setIsOnline(newStatus);
    toast.success(newStatus ? 'Você está online!' : 'Você está offline');
  };

  const handleAccept = async (deliveryId: string) => {
    const ok = await acceptDelivery(deliveryId);
    if (ok) fetchDeliveries();
  };

  const handleAdvance = async () => {
    if (!activeDelivery) return;
    const ok = await advanceDelivery(activeDelivery.id);
    if (ok) {
      if (activeDelivery.status === 'delivering') {
        toast.success('Entrega concluída! 🎉');
      }
      fetchDeliveries();
    }
  };

  const openMaps = (address: string) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, '_blank');
  };

  const statusActions: Record<string, string> = {
    accepted: 'Cheguei no estabelecimento',
    collecting: 'Saí para entrega',
    delivering: 'Entrega concluída',
  };

  const statusLabels: Record<string, string> = {
    accepted: 'Aceito',
    collecting: 'Coletando',
    delivering: 'Entregando',
  };

  const timeSince = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (diff < 1) return 'agora';
    if (diff < 60) return `${diff} min atrás`;
    return `${Math.floor(diff / 60)}h atrás`;
  };

  if (initialLoading) {
    return (
      <div className="p-4 flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Online toggle */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div>
            <p className="font-semibold">Status</p>
            <p className="text-sm text-muted-foreground">
              {isOnline ? 'Online - recebendo corridas' : 'Offline'}
            </p>
          </div>
          <Switch 
            checked={isOnline} 
            onCheckedChange={toggleOnline} 
            disabled={togglingOnline}
          />
        </CardContent>
      </Card>

      {/* Active delivery */}
      {activeDelivery && (
        <Card className="border-primary border-2">
          <CardContent className="py-4 space-y-4">
            {/* Status stepper */}
            <div className="flex items-center justify-between px-2">
              {['accepted', 'collecting', 'delivering'].map((step, i) => {
                const steps = ['accepted', 'collecting', 'delivering'];
                const currentIdx = steps.indexOf(activeDelivery.status);
                const isActive = i <= currentIdx;
                return (
                  <div key={step} className="flex items-center gap-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}>
                      {i < currentIdx ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                    </div>
                    {i < 2 && <div className={`w-8 h-0.5 ${i < currentIdx ? 'bg-primary' : 'bg-muted'}`} />}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between">
              <Badge className="bg-primary text-primary-foreground">
                {statusLabels[activeDelivery.status]}
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
              <Button 
                className="flex-1 font-semibold" 
                onClick={handleAdvance}
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
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
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <p>Nenhuma corrida disponível no momento</p>
                <p className="text-xs mt-1">Novas corridas aparecerão automaticamente</p>
              </CardContent>
            </Card>
          ) : (
            availableDeliveries.map((d) => (
              <Card key={d.id} className="border border-border hover:border-primary transition-colors">
                <CardContent className="py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-lg flex items-center gap-1">
                      <DollarSign className="h-4 w-4 text-primary" />
                      R$ {Number(d.delivery_fee).toFixed(2)}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {d.prep_time_minutes} min
                      </Badge>
                      <span className="text-xs text-muted-foreground">{timeSince(d.created_at)}</span>
                    </div>
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
                  <Button 
                    className="w-full font-semibold" 
                    onClick={() => handleAccept(d.id)}
                    disabled={actionLoading}
                  >
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    Aceitar Corrida
                  </Button>
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
