import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDeliveryActions } from '@/hooks/useDeliveryActions';
import { type MapMarker } from '@/components/MapPicker';
import DriverQueueVisual, { type QueueDriver } from '@/components/DriverQueueVisual';
import ActiveDeliveryCard from '@/components/driver/ActiveDeliveryCard';
import QueueOfferCard from '@/components/driver/QueueOfferCard';
import PoolDeliveriesList from '@/components/driver/PoolDeliveriesList';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Loader2, Power, Ban } from 'lucide-react';
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

// Simple geocode cache to avoid redundant Nominatim calls
const geocodeCache = new Map<string, { lat: number; lng: number }>();

const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
  if (geocodeCache.has(address)) return geocodeCache.get(address)!;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=br`,
      { headers: { 'User-Agent': 'GoodDeliveryApp/1.0' } }
    );
    const data = await res.json();
    if (data.length > 0) {
      const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      geocodeCache.set(address, result);
      return result;
    }
  } catch {}
  return null;
};

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
  const [totalOnlineDrivers, setTotalOnlineDrivers] = useState(0);
  const [searchingCount, setSearchingCount] = useState(0);
  const [queueDrivers, setQueueDrivers] = useState<QueueDriver[]>([]);
  const [currentOffer, setCurrentOffer] = useState<DeliveryOffer | null>(null);
  const [offerTimer, setOfferTimer] = useState(60);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [rejectingOffer, setRejectingOffer] = useState(false);
  const [blockedUntil, setBlockedUntil] = useState<string | null>(null);
  const [blockCountdown, setBlockCountdown] = useState<string | null>(null);
  const [deliveryMapMarkers, setDeliveryMapMarkers] = useState<MapMarker[]>([]);
  const [chatOpen, setChatOpen] = useState(false);

  // Load driver + delivery mode
  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from('drivers').select('id, is_online, blocked_until, queue_joined_at').eq('user_id', user.id).maybeSingle(),
      supabase.from('app_settings').select('value').eq('key', 'delivery_mode').maybeSingle(),
    ]).then(async ([{ data: driverData }, { data: modeData }]) => {
      const mode = (modeData?.value as 'pool' | 'queue') ?? 'pool';
      if (driverData) {
        setDriverId(driverData.id);
        setIsOnline(driverData.is_online);
        setBlockedUntil(driverData.blocked_until ?? null);
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
    if (!blockedUntil) { setBlockCountdown(null); return; }
    const updateCountdown = () => {
      const remaining = new Date(blockedUntil).getTime() - Date.now();
      if (remaining <= 0) {
        setBlockedUntil(null);
        setBlockCountdown(null);
        if (driverId) supabase.from('drivers').update({ blocked_until: null }).eq('id', driverId);
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

  // Geocode addresses for active delivery map (with cache)
  useEffect(() => {
    if (!activeDelivery) { setDeliveryMapMarkers([]); return; }
    let cancelled = false;
    const load = async () => {
      const markers: MapMarker[] = [];
      if (activeDelivery.establishment_lat && activeDelivery.establishment_lng) {
        markers.push({ lat: activeDelivery.establishment_lat, lng: activeDelivery.establishment_lng, label: activeDelivery.establishment_name ?? 'Coleta', color: '#3b82f6' });
      } else if (activeDelivery.establishment_address) {
        const coords = await geocodeAddress(activeDelivery.establishment_address);
        if (coords) markers.push({ lat: coords.lat, lng: coords.lng, label: activeDelivery.establishment_name ?? 'Coleta', color: '#3b82f6' });
      }
      const destCoords = await geocodeAddress(activeDelivery.delivery_address);
      if (destCoords) markers.push({ lat: destCoords.lat, lng: destCoords.lng, label: 'Entrega', color: '#10b981' });
      if (!cancelled) setDeliveryMapMarkers(markers);
    };
    load();
    return () => { cancelled = true; };
  }, [activeDelivery]);

  // Queue position + searching count (shared data for DriverQueueVisual)
  const fetchQueueData = useCallback(async () => {
    if (!driverId || deliveryMode !== 'queue' || !isOnline) {
      setQueuePosition(null);
      setTotalOnlineDrivers(0);
      setSearchingCount(0);
      setQueueDrivers([]);
      return;
    }
    const [driversRes, searchingRes] = await Promise.all([
      supabase.from('drivers').select('id, user_id').eq('is_online', true).not('queue_joined_at', 'is', null).order('queue_joined_at', { ascending: true }),
      supabase.from('deliveries').select('id', { count: 'exact', head: true }).eq('status', 'searching'),
    ]);
    if (driversRes.data) {
      const pos = driversRes.data.findIndex(d => d.id === driverId);
      setQueuePosition(pos >= 0 ? pos + 1 : null);
      setTotalOnlineDrivers(driversRes.data.length);

      // Fetch names for all queued drivers
      const userIds = driversRes.data.map(d => d.user_id);
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
      const nameMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) ?? []);

      setQueueDrivers(driversRes.data.map((d, i) => ({
        id: d.id,
        name: nameMap.get(d.user_id) ?? 'Entregador',
        position: i + 1,
        isMe: d.id === driverId,
      })));
    }
    setSearchingCount(searchingRes.count ?? 0);
  }, [driverId, deliveryMode, isOnline]);

  // Fetch offer for queue mode
  const fetchCurrentOffer = useCallback(async () => {
    if (!driverId || deliveryMode !== 'queue') { setCurrentOffer(null); return; }
    const { data } = await supabase
      .from('delivery_offers')
      .select('id, delivery_id, offered_at, status')
      .eq('driver_id', driverId)
      .eq('status', 'pending')
      .order('offered_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      const { data: del } = await supabase
        .from('deliveries')
        .select('id, delivery_address, delivery_fee, status, establishment_id, created_at, accepted_at, observations, urgency')
        .eq('id', data.delivery_id)
        .maybeSingle();

      let delivery: DeliveryWithEstablishment | undefined;
      if (del) {
        const { data: est } = await supabase.from('establishments').select('business_name, address').eq('id', del.establishment_id).maybeSingle();
        delivery = { ...del, establishment_name: est?.business_name, establishment_address: est?.address };
      }
      setCurrentOffer({ ...data, delivery });
    } else {
      setCurrentOffer(null);
    }
  }, [driverId, deliveryMode]);

  // Offer timer countdown with proper cleanup
  useEffect(() => {
    if (!currentOffer) {
      setOfferTimer(60);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }
    const offerId = currentOffer.id;
    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - new Date(currentOffer.offered_at).getTime()) / 1000);
      const remaining = Math.max(0, 60 - elapsed);
      setOfferTimer(remaining);
      if (remaining === 0) {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        setCurrentOffer(prev => prev?.id === offerId ? null : prev);
        supabase.functions.invoke('process-delivery-queue', { body: { delivery_id: currentOffer.delivery_id } }).catch(() => {});
        fetchCurrentOffer();
      }
    };
    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
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
      setActiveDelivery({ ...active, establishment_name: est?.business_name, establishment_address: est?.address, establishment_lat: est?.latitude, establishment_lng: est?.longitude });
      setAvailableDeliveries([]);
      return;
    }
    setActiveDelivery(null);

    if (deliveryMode === 'queue') {
      fetchQueueData();
      fetchCurrentOffer();
      return;
    }

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
  }, [driverId, isOnline, deliveryMode, fetchQueueData, fetchCurrentOffer]);

  // Realtime subscriptions
  useEffect(() => {
    fetchDeliveries();
    if (!driverId) return;
    const channels: ReturnType<typeof supabase.channel>[] = [];

    channels.push(
      supabase.channel('deliveries-pool')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, () => fetchDeliveries())
        .subscribe()
    );

    if (deliveryMode === 'queue') {
      channels.push(
        supabase.channel('delivery-offers')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_offers' }, () => { fetchCurrentOffer(); fetchQueueData(); })
          .subscribe()
      );
      channels.push(
        supabase.channel('driver-block-status')
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'drivers', filter: `id=eq.${driverId}` }, (payload) => {
            if (payload.new) setBlockedUntil((payload.new as Record<string, unknown>).blocked_until as string | null);
          })
          .subscribe()
      );
      // Also listen for driver changes to update queue visual
      channels.push(
        supabase.channel('queue-drivers-sync')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, () => fetchQueueData())
          .subscribe()
      );
    }

    channels.push(
      supabase.channel('app-settings-mode')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings' }, async (payload) => {
          if (payload.new && (payload.new as Record<string, unknown>).key === 'delivery_mode') {
            const newMode = (payload.new as Record<string, unknown>).value as 'pool' | 'queue';
            setDeliveryMode(newMode);
            toast.info(newMode === 'queue' ? 'Modo alterado para Fila' : 'Modo alterado para Pool Aberto');
            if (newMode === 'queue' && isOnline && driverId) {
              await supabase.from('drivers').update({ queue_joined_at: new Date().toISOString() }).eq('id', driverId);
            }
            if (newMode === 'pool' && driverId) {
              await supabase.from('drivers').update({ queue_joined_at: null }).eq('id', driverId);
            }
          }
        })
        .subscribe()
    );

    return () => { channels.forEach(c => supabase.removeChannel(c)); };
  }, [driverId, isOnline, deliveryMode, fetchDeliveries, fetchCurrentOffer, fetchQueueData]);

  const toggleOnline = async () => {
    if (!driverId || togglingOnline) return;
    if (isOnline && activeDelivery) { toast.error('Finalize a corrida ativa antes de ficar offline'); return; }
    setTogglingOnline(true);
    const newStatus = !isOnline;
    const updateData: { is_online: boolean; queue_joined_at?: string | null } = { is_online: newStatus };
    if (newStatus && deliveryMode === 'queue') updateData.queue_joined_at = new Date().toISOString();
    if (!newStatus) updateData.queue_joined_at = null;
    const { error } = await supabase.from('drivers').update(updateData).eq('id', driverId);
    setTogglingOnline(false);
    if (error) { toast.error('Erro ao alterar status'); return; }
    setIsOnline(newStatus);
    toast.success(newStatus ? 'Você está online!' : 'Você está offline');
  };

  const handleAccept = async (deliveryId: string) => {
    const ok = await acceptDelivery(deliveryId);
    if (ok) { setCurrentOffer(null); fetchDeliveries(); }
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

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isBlocked = blockedUntil && new Date(blockedUntil).getTime() > Date.now();

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
            {isOnline && <div className="absolute inset-0 rounded-full bg-primary-foreground/20 animate-ping" />}
            <Switch checked={isOnline} onCheckedChange={toggleOnline} disabled={togglingOnline} className="scale-125" />
          </div>
        </div>

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
        {activeDelivery && (
          <ActiveDeliveryCard
            delivery={activeDelivery}
            mapMarkers={deliveryMapMarkers}
            actionLoading={actionLoading}
            onAdvance={handleAdvance}
            onOpenChat={() => setChatOpen(true)}
            onOpenMaps={openMaps}
          />
        )}

        {!activeDelivery && isOnline && deliveryMode === 'queue' && currentOffer?.delivery && (
          <QueueOfferCard
            deliveryId={currentOffer.delivery_id}
            delivery={currentOffer.delivery}
            offerTimer={offerTimer}
            actionLoading={actionLoading}
            rejectingOffer={rejectingOffer}
            onAccept={handleAccept}
            onReject={handleRejectOffer}
          />
        )}

        {!activeDelivery && isOnline && deliveryMode === 'queue' && isBlocked && (
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

        {!activeDelivery && isOnline && deliveryMode === 'queue' && !currentOffer && !isBlocked && driverId && (
          <DriverQueueVisual
            position={queuePosition}
            totalDrivers={totalOnlineDrivers}
            searchingCount={searchingCount}
            queueDrivers={queueDrivers}
          />
        )}

        {!activeDelivery && isOnline && deliveryMode === 'pool' && (
          <PoolDeliveriesList
            deliveries={availableDeliveries}
            actionLoading={actionLoading}
            onAccept={handleAccept}
          />
        )}

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
