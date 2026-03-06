import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDeliveryActions } from '@/hooks/useDeliveryActions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { MapPin, DollarSign, Navigation, Clock, Loader2, Store, Package, CheckCircle2, Power, Truck, Radio } from 'lucide-react';

interface DeliveryWithEstablishment {
  id: string;
  customer_name: string;
  delivery_address: string;
  delivery_fee: number;
  status: string;
  prep_time_minutes: number;
  establishment_id: string;
  created_at: string;
  accepted_at: string | null;
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
  const [todayStats, setTodayStats] = useState({ deliveries: 0, earnings: 0 });

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

  // Load today's stats
  useEffect(() => {
    if (!driverId) return;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    supabase
      .from('deliveries')
      .select('delivery_fee')
      .eq('driver_id', driverId)
      .eq('status', 'completed')
      .gte('delivered_at', todayStart.toISOString())
      .then(({ data }) => {
        if (data) {
          setTodayStats({
            deliveries: data.length,
            earnings: data.reduce((s, d) => s + Number(d.delivery_fee), 0),
          });
        }
      });
  }, [driverId, activeDelivery]);

  const fetchDeliveries = useCallback(async () => {
    if (!driverId) return;

    const { data: active } = await supabase
      .from('deliveries')
      .select('id, customer_name, delivery_address, delivery_fee, status, prep_time_minutes, establishment_id, created_at, accepted_at')
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

    if (isOnline) {
      const { data: pool } = await supabase
        .from('deliveries')
        .select('id, customer_name, delivery_address, delivery_fee, status, prep_time_minutes, establishment_id, created_at, accepted_at')
        .eq('status', 'searching')
        .order('created_at', { ascending: false })
        .limit(20);

      if (pool && pool.length > 0) {
        const estIds = [...new Set(pool.map(d => d.establishment_id))];
        const { data: establishments } = await supabase.from('establishments').select('id, business_name, address').in('id', estIds);
        const estMap = new Map(establishments?.map(e => [e.id, e]) ?? []);
        setAvailableDeliveries(pool.map(d => ({
          ...d,
          establishment_name: estMap.get(d.establishment_id)?.business_name,
          establishment_address: estMap.get(d.establishment_id)?.address,
        })));
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, () => fetchDeliveries())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [driverId, isOnline, fetchDeliveries]);

  const toggleOnline = async () => {
    if (!driverId || togglingOnline) return;
    if (isOnline && activeDelivery) {
      toast.error('Finalize a corrida ativa antes de ficar offline');
      return;
    }
    setTogglingOnline(true);
    const newStatus = !isOnline;
    const { error } = await supabase.from('drivers').update({ is_online: newStatus }).eq('id', driverId);
    setTogglingOnline(false);
    if (error) { toast.error('Erro ao alterar status'); return; }
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
      if (activeDelivery.status === 'delivering') toast.success('Entrega concluída! 🎉');
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

  const timeSince = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (diff < 1) return 'agora';
    if (diff < 60) return `${diff}min`;
    return `${Math.floor(diff / 60)}h`;
  };

  const stepperSteps = [
    { key: 'accepted', icon: Store, label: 'Aceito' },
    { key: 'collecting', icon: Package, label: 'Coletando' },
    { key: 'delivering', icon: MapPin, label: 'Entregando' },
  ];

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      {/* Hero status toggle */}
      <div className={`px-4 py-6 ${isOnline ? 'bg-primary' : 'bg-muted'} transition-colors duration-300`}>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-lg font-bold ${isOnline ? 'text-primary-foreground' : 'text-foreground'}`}>
              {isOnline ? 'Você está online' : 'Você está offline'}
            </p>
            <p className={`text-sm ${isOnline ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
              {isOnline ? 'Recebendo corridas' : 'Ative para receber corridas'}
            </p>
          </div>
          <div className="relative">
            {isOnline && (
              <div className="absolute inset-0 rounded-full bg-primary-foreground/20 animate-ping" />
            )}
            <Switch
              checked={isOnline}
              onCheckedChange={toggleOnline}
              disabled={togglingOnline}
              className="scale-125"
            />
          </div>
        </div>

        {/* Today summary */}
        {isOnline && (
          <div className="flex gap-3 mt-4">
            <div className="flex-1 rounded-lg bg-primary-foreground/10 px-3 py-2 backdrop-blur-sm">
              <p className="text-xs text-primary-foreground/70">Entregas hoje</p>
              <p className="text-xl font-bold text-primary-foreground">{todayStats.deliveries}</p>
            </div>
            <div className="flex-1 rounded-lg bg-primary-foreground/10 px-3 py-2 backdrop-blur-sm">
              <p className="text-xs text-primary-foreground/70">Ganho bruto</p>
              <p className="text-xl font-bold text-primary-foreground">R$ {todayStats.earnings.toFixed(2)}</p>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 space-y-4">
        {/* Active delivery */}
        {activeDelivery && (
          <Card className="border-2 border-primary overflow-hidden">
            <div className="bg-primary px-4 py-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-primary-foreground">Entrega Ativa</p>
                {activeDelivery.accepted_at && (
                  <Badge variant="secondary" className="text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    {timeSince(activeDelivery.accepted_at)}
                  </Badge>
                )}
              </div>
            </div>
            <CardContent className="py-4 space-y-4">
              {/* Visual stepper */}
              <div className="flex items-center justify-between px-2">
                {stepperSteps.map((step, i) => {
                  const currentIdx = stepperSteps.findIndex(s => s.key === activeDelivery.status);
                  const done = i < currentIdx;
                  const active = i === currentIdx;
                  const Icon = step.icon;
                  return (
                    <div key={step.key} className="flex items-center">
                      <div className="flex flex-col items-center gap-1">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                          done ? 'bg-green-500 text-white' : active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                        }`}>
                          {done ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                        </div>
                        <span className={`text-[10px] font-medium ${active ? 'text-primary' : 'text-muted-foreground'}`}>
                          {step.label}
                        </span>
                      </div>
                      {i < stepperSteps.length - 1 && (
                        <div className={`w-8 h-0.5 mx-1 mb-4 ${done ? 'bg-green-500' : 'bg-muted'}`} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Value */}
              <div className="text-center">
                <span className="text-2xl font-bold text-primary">R$ {Number(activeDelivery.delivery_fee).toFixed(2)}</span>
              </div>

              {/* Route visualization */}
              <div className="relative pl-6 space-y-3">
                <div className="absolute left-[11px] top-2 bottom-2 w-0.5 border-l-2 border-dashed border-muted-foreground/30" />
                <div className="relative flex items-start gap-3">
                  <div className="absolute -left-6 top-0.5 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                    <Store className="h-3 w-3 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Coleta</p>
                    <p className="text-sm font-medium">{activeDelivery.establishment_name}</p>
                    <p className="text-xs text-muted-foreground">{activeDelivery.establishment_address}</p>
                  </div>
                </div>
                <div className="relative flex items-start gap-3">
                  <div className="absolute -left-6 top-0.5 h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
                    <MapPin className="h-3 w-3 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Entrega</p>
                    <p className="text-sm font-medium">{activeDelivery.customer_name}</p>
                    <p className="text-xs text-muted-foreground">{activeDelivery.delivery_address}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  className="flex-1 h-12 font-bold text-base"
                  onClick={handleAdvance}
                  disabled={actionLoading}
                >
                  {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {statusActions[activeDelivery.status]}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12"
                  onClick={() => openMaps(
                    activeDelivery.status === 'accepted' || activeDelivery.status === 'collecting'
                      ? activeDelivery.establishment_address ?? ''
                      : activeDelivery.delivery_address
                  )}
                >
                  <Navigation className="h-5 w-5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pool */}
        {!activeDelivery && isOnline && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">Corridas Disponíveis</h2>
              <Badge variant="secondary">{availableDeliveries.length}</Badge>
            </div>
            {availableDeliveries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="relative mb-4">
                  <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <Radio className="h-10 w-10 text-primary" />
                  </div>
                  <div className="absolute inset-0 h-20 w-20 rounded-full bg-primary/10 animate-ping" />
                </div>
                <p className="font-semibold text-lg">Buscando corridas...</p>
                <p className="text-sm text-muted-foreground mt-1">Novas corridas aparecerão automaticamente</p>
              </div>
            ) : (
              availableDeliveries.map((d) => (
                <Card key={d.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <CardContent className="p-0">
                    {/* Value header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-muted/50">
                      <span className="text-xl font-bold text-primary flex items-center gap-1">
                        <DollarSign className="h-5 w-5" />
                        R$ {Number(d.delivery_fee).toFixed(2)}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />{d.prep_time_minutes}min
                        </Badge>
                        <span className="text-xs text-muted-foreground">{timeSince(d.created_at)}</span>
                      </div>
                    </div>
                    {/* Route */}
                    <div className="px-4 py-3 space-y-2">
                      <div className="relative pl-6 space-y-3">
                        <div className="absolute left-[11px] top-2 bottom-2 w-0.5 border-l-2 border-dashed border-muted-foreground/30" />
                        <div className="relative flex items-start gap-2">
                          <div className="absolute -left-6 top-0.5 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                            <Store className="h-3 w-3 text-primary-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{d.establishment_name}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[240px]">{d.establishment_address}</p>
                          </div>
                        </div>
                        <div className="relative flex items-start gap-2">
                          <div className="absolute -left-6 top-0.5 h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
                            <MapPin className="h-3 w-3 text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{d.customer_name}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[240px]">{d.delivery_address}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Accept button */}
                    <div className="px-4 pb-3">
                      <Button
                        className="w-full h-11 font-bold"
                        onClick={() => handleAccept(d.id)}
                        disabled={actionLoading}
                      >
                        {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        <Truck className="h-4 w-4 mr-2" />
                        Aceitar Corrida
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Offline state */}
        {!activeDelivery && !isOnline && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center mb-6">
              <Power className="h-12 w-12 text-muted-foreground" />
            </div>
            <p className="text-xl font-bold">Você está offline</p>
            <p className="text-muted-foreground mt-2 max-w-[260px]">Fique online para começar a receber corridas e ganhar dinheiro</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DriverHome;
