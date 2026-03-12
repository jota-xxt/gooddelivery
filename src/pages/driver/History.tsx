import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, Clock, Store, MapPin, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface HistoryDelivery {
  id: string;
  delivery_address: string;
  delivery_fee: number;
  delivered_at: string | null;
  cancelled_at: string | null;
  status: string;
  establishment_name: string;
}

const PAGE_SIZE = 30;

const getDateFilter = (period: string): string | null => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'today') return todayStart.toISOString();
  if (period === 'week') {
    const weekStart = new Date(todayStart);
    const day = weekStart.getDay();
    weekStart.setDate(weekStart.getDate() - (day === 0 ? 6 : day - 1)); // Monday
    return weekStart.toISOString();
  }
  if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  return null; // 'all'
};

const DriverHistory = () => {
  const { user } = useAuth();
  const [deliveries, setDeliveries] = useState<HistoryDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [period, setPeriod] = useState('week');
  const [feePercent, setFeePercent] = useState(10);
  const [hasMore, setHasMore] = useState(false);
  const [driverIdRef, setDriverIdRef] = useState<string | null>(null);

  const loadDeliveries = useCallback(async (driverId: string, periodVal: string, offset = 0) => {
    let query = supabase
      .from('deliveries')
      .select('id, delivery_address, delivery_fee, delivered_at, cancelled_at, status, establishment_id')
      .eq('driver_id', driverId)
      .in('status', ['completed', 'cancelled'])
      .order('delivered_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + PAGE_SIZE - 1);

    const dateFilter = getDateFilter(periodVal);
    if (dateFilter) {
      query = query.gte('delivered_at', dateFilter);
    }

    const { data } = await query;
    if (!data) return [];

    const estIds = [...new Set(data.map(d => d.establishment_id))];
    let estMap = new Map<string, string>();
    if (estIds.length > 0) {
      const { data: ests } = await supabase.from('establishments').select('id, business_name').in('id', estIds);
      estMap = new Map(ests?.map(e => [e.id, e.business_name]) ?? []);
    }

    const mapped = data.map(d => ({
      ...d,
      establishment_name: estMap.get(d.establishment_id) ?? 'Desconhecido',
    }));

    setHasMore(data.length === PAGE_SIZE);
    return mapped;
  }, []);

  useEffect(() => {
    if (!user) return;
    const init = async () => {
      setLoading(true);
      const [{ data: driver }, { data: settings }] = await Promise.all([
        supabase.from('drivers').select('id').eq('user_id', user.id).maybeSingle(),
        supabase.from('app_settings').select('value').eq('key', 'platform_fee_percentage').maybeSingle(),
      ]);
      setFeePercent(Number(settings?.value ?? 10));
      if (!driver) { setLoading(false); return; }
      setDriverIdRef(driver.id);
      const results = await loadDeliveries(driver.id, period);
      setDeliveries(results);
      setLoading(false);
    };
    init();
  }, [user, period, loadDeliveries]);

  const loadMore = async () => {
    if (!driverIdRef || loadingMore) return;
    setLoadingMore(true);
    const more = await loadDeliveries(driverIdRef, period, deliveries.length);
    setDeliveries(prev => [...prev, ...more]);
    setLoadingMore(false);
  };

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Histórico</h1>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="week">Semana</SelectItem>
            <SelectItem value="month">Mês</SelectItem>
            <SelectItem value="all">Tudo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {deliveries.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Package className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="font-semibold">Nenhuma entrega no período</p>
          <p className="text-sm text-muted-foreground mt-1">Suas entregas concluídas aparecerão aqui</p>
        </div>
      ) : (
        <div className="space-y-3">
          {deliveries.map(d => {
            const net = Number(d.delivery_fee) * (1 - feePercent / 100);
            const dateStr = d.delivered_at ?? d.cancelled_at;
            const isCancelled = d.status === 'cancelled';
            return (
              <Card key={d.id} className={isCancelled ? 'opacity-60' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${isCancelled ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                        <Store className={`h-4 w-4 ${isCancelled ? 'text-destructive' : 'text-primary'}`} />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{d.establishment_name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {dateStr ? format(new Date(dateStr), "dd/MM 'às' HH:mm", { locale: ptBR }) : '-'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {isCancelled ? (
                        <Badge variant="destructive" className="text-xs">Cancelada</Badge>
                      ) : (
                        <p className="font-bold text-primary">R$ {net.toFixed(2)}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{d.delivery_address}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {hasMore && (
            <Button variant="outline" className="w-full" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Carregar mais
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default DriverHistory;
