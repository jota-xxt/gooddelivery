import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Truck, Store, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import MapPicker, { type MapMarker } from '@/components/MapPicker';

interface ActiveDelivery {
  id: string;
  delivery_address: string;
  status: string;
  establishment_id: string;
  establishment_name?: string;
  establishment_lat?: number | null;
  establishment_lng?: number | null;
  delivery_lat?: number | null;
  delivery_lng?: number | null;
}

interface OnlineDriver {
  id: string;
  user_id: string;
  full_name?: string;
  lat?: number | null;
  lng?: number | null;
}

const statusColors: Record<string, string> = {
  searching: '#f59e0b',
  accepted: '#3b82f6',
  collecting: '#8b5cf6',
  delivering: '#10b981',
};

const statusLabels: Record<string, string> = {
  searching: 'Buscando',
  accepted: 'Aceito',
  collecting: 'Coletando',
  delivering: 'Entregando',
};

// Geocode cache to avoid repeated Nominatim requests
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
  } catch { /* ignore */ }
  return null;
};

const AdminMapOverview = () => {
  const [deliveries, setDeliveries] = useState<ActiveDelivery[]>([]);
  const [drivers, setDrivers] = useState<OnlineDriver[]>([]);
  const [allMarkers, setAllMarkers] = useState<MapMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilters, setStatusFilters] = useState<Set<string>>(new Set(['searching', 'accepted', 'collecting', 'delivering']));

  const fetchData = useCallback(async () => {
    const [{ data: dels }, { data: drvs }, { data: ests }] = await Promise.all([
      supabase.from('deliveries').select('id, delivery_address, status, establishment_id')
        .in('status', ['searching', 'accepted', 'collecting', 'delivering']),
      supabase.from('drivers').select('id, user_id').eq('is_online', true),
      supabase.from('establishments').select('id, business_name, latitude, longitude'),
    ]);

    const estMap = new Map(ests?.map(e => [e.id, e]) ?? []);

    // Enrich deliveries with establishment data
    const enrichedDeliveries: ActiveDelivery[] = (dels ?? []).map(d => {
      const est = estMap.get(d.establishment_id);
      return {
        ...d,
        establishment_name: est?.business_name,
        establishment_lat: (est as any)?.latitude,
        establishment_lng: (est as any)?.longitude,
      };
    });

    // Geocode delivery addresses
    const geocodePromises = enrichedDeliveries.map(async (d) => {
      const coords = await geocodeAddress(d.delivery_address);
      if (coords) {
        d.delivery_lat = coords.lat;
        d.delivery_lng = coords.lng;
      }
    });
    await Promise.all(geocodePromises);

    // Build markers
    const newMarkers: MapMarker[] = [];

    enrichedDeliveries.forEach(d => {
      if (d.establishment_lat && d.establishment_lng) {
        newMarkers.push({
          lat: d.establishment_lat,
          lng: d.establishment_lng,
          label: `<b>${d.establishment_name ?? 'Estabelecimento'}</b><br/>Coleta`,
          color: statusColors[d.status] ?? '#666',
        });
      }
      if (d.delivery_lat && d.delivery_lng) {
        newMarkers.push({
          lat: d.delivery_lat,
          lng: d.delivery_lng,
          label: `<b>Entrega</b><br/>${d.delivery_address}<br/><span style="color:${statusColors[d.status]}">${statusLabels[d.status]}</span>`,
          color: '#10b981',
        });
      }
    });

    // Get driver profiles for names
    if (drvs && drvs.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name')
        .in('user_id', drvs.map(d => d.user_id));
      const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) ?? []);

      drvs.forEach(d => {
        (d as any).full_name = profileMap.get(d.user_id) ?? 'Entregador';
      });
    }

    setDeliveries(enrichedDeliveries);
    setDrivers((drvs ?? []) as any);
    setAllMarkers(newMarkers);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('admin-map-deliveries')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[500px] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5">
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Mapa de Entregas</h1>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold text-primary">{deliveries.length}</p>
            <p className="text-xs text-muted-foreground">Entregas ativas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold text-primary">{drivers.length}</p>
            <p className="text-xs text-muted-foreground">Entregadores online</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold" style={{ color: '#f59e0b' }}>
              {deliveries.filter(d => d.status === 'searching').length}
            </p>
            <p className="text-xs text-muted-foreground">Buscando entregador</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold" style={{ color: '#10b981' }}>
              {deliveries.filter(d => d.status === 'delivering').length}
            </p>
            <p className="text-xs text-muted-foreground">Em entrega</p>
          </CardContent>
        </Card>
      </div>

      {/* Map */}
      <Card>
        <CardContent className="p-2">
          <MapPicker
            mode="view"
            markers={markers}
            height="500px"
            zoom={markers.length > 0 ? undefined : 4}
          />
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(statusLabels).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: statusColors[key] }} />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: '#10b981' }} />
          <span className="text-xs text-muted-foreground">Destino entrega</span>
        </div>
      </div>

      {/* Active deliveries list */}
      {deliveries.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <Truck className="h-4 w-4" /> Entregas Ativas
          </h2>
          {deliveries.map(d => (
            <Card key={d.id} className="overflow-hidden">
              <CardContent className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ backgroundColor: statusColors[d.status] + '20' }}>
                    <Store className="h-4 w-4" style={{ color: statusColors[d.status] }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{d.establishment_name ?? 'Estabelecimento'}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">{d.delivery_address}</p>
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  style={{ backgroundColor: statusColors[d.status] + '20', color: statusColors[d.status] }}
                >
                  {statusLabels[d.status]}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminMapOverview;
