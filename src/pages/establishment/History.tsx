import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { format, differenceInMinutes, subDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Clock, User, MapPin, Package, Filter, TrendingUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Delivery {
  id: string;
  delivery_address: string;
  delivery_fee: number;
  status: string;
  created_at: string;
  delivered_at: string | null;
  cancelled_at: string | null;
  driver_id: string | null;
  driver_name?: string;
}

const EstablishmentHistory = () => {
  const { user } = useAuth();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState('30');

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const { data: est } = await supabase.from('establishments').select('id').eq('user_id', user.id).maybeSingle();
      if (!est) return;

      const since = subDays(new Date(), parseInt(dateRange)).toISOString();
      const { data } = await supabase
        .from('deliveries')
        .select('id, delivery_address, delivery_fee, status, created_at, delivered_at, cancelled_at, driver_id')
        .eq('establishment_id', est.id)
        .in('status', ['completed', 'cancelled'])
        .gte('created_at', since)
        .order('created_at', { ascending: false });

      if (!data) return;

      // Fetch driver names
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
    };
    fetchData();
  }, [user, dateRange]);

  // Filtered deliveries
  const filtered = deliveries.filter(d => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    if (search && !d.delivery_address.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Chart data - deliveries per day
  const chartData = (() => {
    const days = parseInt(dateRange);
    const map = new Map<string, number>();
    for (let i = days - 1; i >= 0; i--) {
      const d = format(subDays(new Date(), i), 'dd/MM');
      map.set(d, 0);
    }
    deliveries.filter(d => d.status === 'completed').forEach(d => {
      const key = format(new Date(d.created_at), 'dd/MM');
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([date, count]) => ({ date, entregas: count }));
  })();

  const completedCount = deliveries.filter(d => d.status === 'completed').length;
  const cancelledCount = deliveries.filter(d => d.status === 'cancelled').length;

  const getDeliveryTime = (d: Delivery) => {
    if (!d.delivered_at) return null;
    return differenceInMinutes(new Date(d.delivered_at), new Date(d.created_at));
  };

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground px-4 pt-6 pb-10 rounded-b-3xl">
        <h1 className="text-xl font-bold">Histórico</h1>
        <p className="text-sm text-primary-foreground/70">
          {completedCount} concluídas · {cancelledCount} canceladas
        </p>
      </div>

      {/* Chart */}
      <div className="px-4 -mt-6">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5 text-primary" /> Entregas por dia
              </p>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[100px] h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 dias</SelectItem>
                  <SelectItem value="14">14 dias</SelectItem>
                  <SelectItem value="30">30 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorEntregas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(358, 82%, 53%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(358, 82%, 53%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis hide allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="entregas" stroke="hsl(358, 82%, 53%)" fill="url(#colorEntregas)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="p-4 space-y-4">
        {/* Filters */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar endereço..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[120px] h-9">
              <Filter className="h-3.5 w-3.5 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="completed">Concluídas</SelectItem>
              <SelectItem value="cancelled">Canceladas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-2 text-muted-foreground/50" />
              Nenhuma entrega encontrada
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((d) => {
              const deliveryTime = getDeliveryTime(d);
              return (
                <Card key={d.id}>
                  <CardContent className="py-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={d.status === 'completed' ? 'default' : 'destructive'} className="text-[10px]">
                          {d.status === 'completed' ? 'Concluída' : 'Cancelada'}
                        </Badge>
                        {deliveryTime && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Clock className="h-3 w-3" /> {deliveryTime}min
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(d.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </span>
                    </div>

                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <p className="text-sm">{d.delivery_address}</p>
                    </div>

                    <div className="flex items-center justify-between">
                      {d.driver_name ? (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="bg-primary/10 text-primary text-[8px]">
                              {d.driver_name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-muted-foreground">{d.driver_name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                      <span className="text-sm font-bold">R$ {Number(d.delivery_fee).toFixed(2)}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default EstablishmentHistory;
