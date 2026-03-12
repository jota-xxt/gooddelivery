import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDeliveryActions } from '@/hooks/useDeliveryActions';
import MapPicker, { type MapMarker } from '@/components/MapPicker';
import DriverQueueVisual from '@/components/DriverQueueVisual';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { MapPin, DollarSign, Navigation, Clock, Loader2, Store, Package, CheckCircle2, Power, Truck, Radio, ListOrdered, X, Timer, Ban, MessageSquare } from 'lucide-react';
import ChatDialog from '@/components/ChatDialog';

interface DeliveryWithEstablishment {
  id: string;
  delivery_address: string;
  delivery_fee: number;
  status: string;
  establishment_id: string;
  created_at: string;
  accepted_at: string | null;
  observations: string | null;
  urgency: string;
  establishment_name?: string;
  establishment_address?: string;
  establishment_lat?: number | null;
  establishment_lng?: number | null;
}

interface DeliveryOffer {
  id: string;
  delivery_id: string;
  offered_at: string;
  status: string;
  delivery?: DeliveryWithEstablishment;
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
  const [deliveryMode, setDeliveryMode] = useState<'pool' | 'queue'>('pool');
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [currentOffer, setCurrentOffer] = useState<DeliveryOffer | null>(null);
  const [offerTimer, setOfferTimer] = useState(60);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [rejectingOffer, setRejectingOffer] = useState(false);
  const [blockedUntil, setBlockedUntil] = useState<string | null>(null);
  const [blockCountdown, setBlockCountdown] = useState<string | null>(null);
  const [deliveryMapMarkers, setDeliveryMapMarkers] = useState<MapMarker[]>([]);
  const [chatOpen, setChatOpen] = useState(false);

  // Load driver + delivery mode
  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from('drivers').select('id, is_online, blocked_until').eq('user_id', user.id).maybeSingle(),
      supabase.from('app_settings').select('value').eq('key', 'delivery_mode').maybeSingle(),
    ]).then(async ([{ data: driverData }, { data: modeData }]) => {
      const mode = (modeData?.value as 'pool' | 'queue') ?? 'pool';
      if (driverData) {
        setDriverId(driverData.id);
        setIsOnline(driverData.is_online);
        setBlockedUntil(driverData.blocked_until ?? null);
        // Fix: if driver is online in queue mode but queue_joined_at is null, set it
        if (driverData.is_online && mode === 'queue' && !driverData.queue_joined_at) {
          await supabase.from('drivers').update({ queue_joined_at: new Date().toISOString() }).eq('id', driverData.id);
        }
      }
      if (modeData) setDeliveryMode(mode);
      setInitialLoading(false);
    });
  }, [user]);

  // Block countdown timer
  useEffect(() => {
    if (!blockedUntil) {
      setBlockCountdown(null);
      return;
    }

    const updateCountdown = () => {
      const remaining = new Date(blockedUntil).getTime() - Date.now();
      if (remaining <= 0) {
        setBlockedUntil(null);
        setBlockCountdown(null);
        // Clear blocked_until in DB
        if (driverId) {
          supabase.from('drivers').update({ blocked_until: null }).eq('id', driverId).then(() => {});
        }
        return;
      }
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setBlockCountdown(`${mins}:${secs.toString().padStart(2, '0')}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [blockedUntil, driverId]);

  // Today's stats
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

  // Geocode addresses for active delivery map
  useEffect(() => {
    if (!activeDelivery) { setDeliveryMapMarkers([]); return; }
    const markers: MapMarker[] = [];
    const promises: Promise<void>[] = [];

    // Establishment pin (use saved coords or geocode)
    if (activeDelivery.establishment_lat && activeDelivery.establishment_lng) {
      markers.push({ lat: activeDelivery.establishment_lat, lng: activeDelivery.establishment_lng, label: activeDelivery.establishment_name ?? 'Coleta', color: '#3b82f6' });
    } else if (activeDelivery.establishment_address) {
      promises.push(
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(activeDelivery.establishment_address)}&limit=1&countrycodes=br`, { headers: { 'User-Agent': 'GoodDeliveryApp/1.0' } })
          .then(r => r.json())
          .then(data => { if (data.length > 0) markers.push({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), label: activeDelivery.establishment_name ?? 'Coleta', color: '#3b82f6' }); })
          .catch(() => {})
      );
    }

    // Delivery address geocode
    promises.push(
      fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(activeDelivery.delivery_address)}&limit=1&countrycodes=br`, { headers: { 'User-Agent': 'GoodDeliveryApp/1.0' } })
        .then(r => r.json())
        .then(data => { if (data.length > 0) markers.push({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), label: 'Entrega', color: '#10b981' }); })
        .catch(() => {})
    );

    Promise.all(promises).then(() => setDeliveryMapMarkers(markers));
  }, [activeDelivery]);

  // Queue position
  const fetchQueuePosition = useCallback(async () => {
    if (!driverId || deliveryMode !== 'queue' || !isOnline) {
      setQueuePosition(null);
      return;
    }
    const { data: drivers } = await supabase
      .from('drivers')
      .select('id')
      .eq('is_online', true)
      .not('queue_joined_at', 'is', null)
      .order('queue_joined_at', { ascending: true });

    if (drivers) {
      const pos = drivers.findIndex(d => d.id === driverId);
      setQueuePosition(pos >= 0 ? pos + 1 : null);
    }
  }, [driverId, deliveryMode, isOnline]);

  // Fetch offer for queue mode
  const fetchCurrentOffer = useCallback(async () => {
    if (!driverId || deliveryMode !== 'queue') {
      setCurrentOffer(null);
      return;
    }

    // Use any type since delivery_offers is new and not in generated types yet
    const { data } = await supabase
      .from('delivery_offers' as any)
      .select('id, delivery_id, offered_at, status')
      .eq('driver_id', driverId)
      .eq('status', 'pending')
      .order('offered_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      // Fetch delivery details
      const { data: del } = await supabase
        .from('deliveries')
        .select('id, delivery_address, delivery_fee, status, establishment_id, created_at, accepted_at, observations, urgency')
        .eq('id', (data as any).delivery_id)
        .maybeSingle();

      let delivery: DeliveryWithEstablishment | undefined;
      if (del) {
        const { data: est } = await supabase.from('establishments').select('business_name, address').eq('id', del.establishment_id).maybeSingle();
        delivery = { ...del, establishment_name: est?.business_name, establishment_address: est?.address };
      }

      setCurrentOffer({ ...(data as any), delivery });
    } else {
      setCurrentOffer(null);
    }
  }, [driverId, deliveryMode]);

  // Offer timer countdown
  useEffect(() => {
    if (!currentOffer) {
      setOfferTimer(60);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - new Date(currentOffer.offered_at).getTime()) / 1000);
      const remaining = Math.max(0, 60 - elapsed);
      setOfferTimer(remaining);
      if (remaining === 0) {
        setCurrentOffer(null);
        if (timerRef.current) clearInterval(timerRef.current);
        // Reprocess queue so next driver gets the offer
        supabase.functions.invoke('process-delivery-queue', {
          body: { delivery_id: currentOffer.delivery_id },
        }).catch(() => {});
        fetchCurrentOffer();
      }
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [currentOffer, fetchCurrentOffer]);

  const fetchDeliveries = useCallback(async () => {
    if (!driverId) return;

    const { data: active } = await supabase
      .from('deliveries')
      .select('id, delivery_address, delivery_fee, status, establishment_id, created_at, accepted_at, observations, urgency')
      .eq('driver_id', driverId)
      .in('status', ['accepted', 'collecting', 'delivering'])
      .limit(1)
      .maybeSingle();

    if (active) {
      const { data: est } = await supabase.from('establishments').select('business_name, address, latitude, longitude').eq('id', active.establishment_id).maybeSingle();
      setActiveDelivery({
        ...active,
        establishment_name: est?.business_name,
        establishment_address: est?.address,
        establishment_lat: est?.latitude,
        establishment_lng: est?.longitude,
      });
      setAvailableDeliveries([]);
      return;
    }
    setActiveDelivery(null);

    if (deliveryMode === 'queue') {
      fetchQueuePosition();
      fetchCurrentOffer();
      return;
    }

    // Pool mode
    if (isOnline) {
      const { data: pool } = await supabase
        .from('deliveries')
      .select('id, delivery_address, delivery_fee, status, establishment_id, created_at, accepted_at, observations, urgency')
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
  }, [driverId, isOnline, deliveryMode, fetchQueuePosition, fetchCurrentOffer]);

  useEffect(() => {
    fetchDeliveries();
    if (!driverId) return;

    const channels: ReturnType<typeof supabase.channel>[] = [];

    const deliveriesChannel = supabase
      .channel('deliveries-pool')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, () => fetchDeliveries())
      .subscribe();
    channels.push(deliveriesChannel);

    if (deliveryMode === 'queue') {
      const offersChannel = supabase
        .channel('delivery-offers')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_offers' }, () => {
          fetchCurrentOffer();
          fetchQueuePosition();
        })
        .subscribe();
      channels.push(offersChannel);

      // Listen for driver blocked_until changes
      const driversChannel = supabase
        .channel('driver-block-status')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'drivers', filter: `id=eq.${driverId}` }, (payload) => {
          if (payload.new) {
            setBlockedUntil((payload.new as any).blocked_until ?? null);
          }
        })
        .subscribe();
      channels.push(driversChannel);
    }

    // C) Listen for delivery_mode changes in real-time
    const settingsChannel = supabase
      .channel('app-settings-mode')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings' }, async (payload) => {
        if (payload.new && (payload.new as any).key === 'delivery_mode') {
          const newMode = (payload.new as any).value as 'pool' | 'queue';
          setDeliveryMode(newMode);
          toast.info(newMode === 'queue' ? 'Modo alterado para Fila' : 'Modo alterado para Pool Aberto');
          // If switching to queue and driver is already online, set queue_joined_at
          if (newMode === 'queue' && isOnline && driverId) {
            await supabase.from('drivers').update({ queue_joined_at: new Date().toISOString() }).eq('id', driverId);
          }
          // If switching to pool, clear queue_joined_at
          if (newMode === 'pool' && driverId) {
            await supabase.from('drivers').update({ queue_joined_at: null }).eq('id', driverId);
          }
        }
      })
      .subscribe();
    channels.push(settingsChannel);

    return () => { channels.forEach(c => supabase.removeChannel(c)); };
  }, [driverId, isOnline, deliveryMode, fetchDeliveries, fetchCurrentOffer, fetchQueuePosition]);

  const toggleOnline = async () => {
    if (!driverId || togglingOnline) return;
    if (isOnline && activeDelivery) {
      toast.error('Finalize a corrida ativa antes de ficar offline');
      return;
    }
    setTogglingOnline(true);
    const newStatus = !isOnline;
    const updateData: Record<string, unknown> = { is_online: newStatus };
    if (newStatus && deliveryMode === 'queue') {
      updateData.queue_joined_at = new Date().toISOString();
    }
    if (!newStatus) {
      updateData.queue_joined_at = null;
    }
    const { error } = await supabase.from('drivers').update(updateData).eq('id', driverId);
    setTogglingOnline(false);
    if (error) { toast.error('Erro ao alterar status'); return; }
    setIsOnline(newStatus);
    toast.success(newStatus ? 'Você está online!' : 'Você está offline');
  };

  const handleAccept = async (deliveryId: string) => {
    const ok = await acceptDelivery(deliveryId);
    if (ok) {
      setCurrentOffer(null);
      fetchDeliveries();
    }
  };

  const handleRejectOffer = async () => {
    if (!currentOffer) return;
    setRejectingOffer(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-delivery-status', {
        body: { delivery_id: currentOffer.delivery_id, action: 'reject' },
      });
      if (error || data?.error) {
        toast.error(data?.error || 'Erro ao rejeitar');
      } else {
        toast.info('Corrida rejeitada. Aguardando próxima...');
        setCurrentOffer(null);
      }
    } catch {
      toast.error('Erro inesperado');
    } finally {
      setRejectingOffer(false);
    }
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
              {isOnline
                ? deliveryMode === 'queue' ? 'Modo fila ativo' : 'Recebendo corridas'
                : 'Ative para receber corridas'}
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

              {/* Delivery map */}
              {deliveryMapMarkers.length > 0 && (
                <MapPicker
                  mode="view"
                  markers={deliveryMapMarkers}
                  height="180px"
                />
              )}

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
                    <p className="text-sm font-medium truncate max-w-[240px]">{activeDelivery.delivery_address}</p>
                    {activeDelivery.observations && <p className="text-xs text-muted-foreground">{activeDelivery.observations}</p>}
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
                  onClick={() => setChatOpen(true)}
                >
                  <MessageSquare className="h-5 w-5" />
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

        {/* Queue mode: offer card */}
        {!activeDelivery && isOnline && deliveryMode === 'queue' && currentOffer?.delivery && (
          <Card className="border-2 border-primary overflow-hidden animate-in fade-in">
            <div className="bg-primary px-4 py-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-primary-foreground">Nova Corrida Para Você!</p>
              <div className="flex items-center gap-1.5">
                <Timer className="h-4 w-4 text-primary-foreground" />
                <span className={`text-lg font-bold text-primary-foreground ${offerTimer <= 10 ? 'animate-pulse' : ''}`}>
                  {offerTimer}s
                </span>
              </div>
            </div>
            <CardContent className="py-4 space-y-4">
              {/* Timer progress bar */}
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${offerTimer <= 10 ? 'bg-destructive' : 'bg-primary'}`}
                  style={{ width: `${(offerTimer / 60) * 100}%` }}
                />
              </div>

              {/* Value */}
              <div className="text-center">
                <span className="text-3xl font-bold text-primary flex items-center justify-center gap-1">
                  <DollarSign className="h-6 w-6" />
                  R$ {Number(currentOffer.delivery.delivery_fee).toFixed(2)}
                </span>
              </div>

              {/* Route */}
              <div className="relative pl-6 space-y-3">
                <div className="absolute left-[11px] top-2 bottom-2 w-0.5 border-l-2 border-dashed border-muted-foreground/30" />
                <div className="relative flex items-start gap-2">
                  <div className="absolute -left-6 top-0.5 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                    <Store className="h-3 w-3 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{currentOffer.delivery.establishment_name}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[240px]">{currentOffer.delivery.establishment_address}</p>
                  </div>
                </div>
                <div className="relative flex items-start gap-2">
                  <div className="absolute -left-6 top-0.5 h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
                    <MapPin className="h-3 w-3 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium truncate max-w-[240px]">{currentOffer.delivery.delivery_address}</p>
                    {currentOffer.delivery.observations && <p className="text-xs text-muted-foreground">{currentOffer.delivery.observations}</p>}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  className="flex-1 h-12 font-bold text-base"
                  onClick={() => handleAccept(currentOffer.delivery_id)}
                  disabled={actionLoading}
                >
                  {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  <Truck className="h-4 w-4 mr-2" />
                  Aceitar
                </Button>
                <Button
                  variant="destructive"
                  className="h-12 px-6 font-bold"
                  onClick={handleRejectOffer}
                  disabled={rejectingOffer}
                >
                  {rejectingOffer ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-5 w-5" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Blocked state */}
        {!activeDelivery && isOnline && deliveryMode === 'queue' && blockedUntil && new Date(blockedUntil).getTime() > Date.now() && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <Ban className="h-10 w-10 text-destructive" />
            </div>
            <p className="font-semibold text-lg">Temporariamente bloqueado</p>
            <p className="text-sm text-muted-foreground mt-1">Você perdeu/recusou muitas ofertas</p>
            {blockCountdown && (
              <div className="mt-4 px-6 py-3 rounded-xl bg-destructive/10 border border-destructive/20">
                <p className="text-xs text-muted-foreground">Desbloqueio em</p>
                <p className="text-2xl font-bold text-destructive">{blockCountdown}</p>
              </div>
            )}
          </div>
        )}

        {!activeDelivery && isOnline && deliveryMode === 'queue' && !currentOffer && (!blockedUntil || new Date(blockedUntil).getTime() <= Date.now()) && driverId && (
          <DriverQueueVisual driverId={driverId} isOnline={isOnline} />
        )}

        {/* Pool mode */}
        {!activeDelivery && isOnline && deliveryMode === 'pool' && (
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
                    <div className="flex items-center justify-between px-4 py-3 bg-muted/50">
                      <span className="text-xl font-bold text-primary flex items-center gap-1">
                        <DollarSign className="h-5 w-5" />
                        R$ {Number(d.delivery_fee).toFixed(2)}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{timeSince(d.created_at)}</span>
                      </div>
                    </div>
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
                            <p className="text-sm font-medium truncate max-w-[240px]">{d.delivery_address}</p>
                            {d.observations && <p className="text-xs text-muted-foreground">{d.observations}</p>}
                          </div>
                        </div>
                      </div>
                    </div>
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

      {/* Chat Dialog */}
      {activeDelivery && (
        <ChatDialog
          deliveryId={activeDelivery.id}
          open={chatOpen}
          onOpenChange={setChatOpen}
          otherPartyName={activeDelivery.establishment_name}
        />
      )}
    </div>
  );
};

export default DriverHome;
