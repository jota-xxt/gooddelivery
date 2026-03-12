import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { Package, Users, DollarSign, Truck, TrendingUp, Clock, ArrowUpRight, CheckCircle, XCircle, Timer, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, subDays, startOfDay, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DeliveryRow {
  id: string;
  customer_name: string;
  delivery_address: string;
  delivery_fee: number;
  status: string;
  created_at: string;
  accepted_at: string | null;
  delivered_at: string | null;
  driver_id: string | null;
  driver_name?: string;
}

const statusLabel: Record<string, string> = {
  searching: 'Buscando', accepted: 'Aceito', collecting: 'Coletando',
  delivering: 'Entregando', completed: 'Concluído', cancelled: 'Cancelado',
};
const statusColor: Record<string, string> = {
  searching: 'bg-warning/15 text-warning', accepted: 'bg-blue-500/15 text-blue-600',
  collecting: 'bg-purple-500/15 text-purple-600', delivering: 'bg-primary/15 text-primary',
  completed: 'bg-success/15 text-success', cancelled: 'bg-destructive/15 text-destructive',
};

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalDeliveries: 0, activeDrivers: 0, activeEstablishments: 0, revenue: 0,
    completionRate: 0, avgDeliveryMin: 0,
    prevTotal: 0, prevRevenue: 0,
  });
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [chartData, setChartData] = useState<{ day: string; entregas: number; receita: number }[]>([]);
  const [recentDeliveries, setRecentDeliveries] = useState<DeliveryRow[]>([]);
  const [activeDeliveries, setActiveDeliveries] = useState<DeliveryRow[]>([]);

  const fetchAll = useCallback(async () => {
    const sevenDaysAgo = subDays(new Date(), 6);
    const fourteenDaysAgo = subDays(new Date(), 13);

    const ninetyDaysAgo = subDays(new Date(), 90).toISOString();
    const [deliveries, drivers, establishments, recent, active, approvals] = await Promise.all([
      supabase.from('deliveries').select('id, delivery_fee, status, created_at, accepted_at, delivered_at').gte('created_at', ninetyDaysAgo),
      supabase.from('drivers').select('id', { count: 'exact' }).eq('is_online', true),
      supabase.from('establishments').select('id', { count: 'exact' }),
      supabase.from('deliveries')
        .select('id, customer_name, delivery_address, delivery_fee, status, created_at, accepted_at, delivered_at')
        .order('created_at', { ascending: false }).limit(8),
      supabase.from('deliveries')
        .select('id, customer_name, delivery_address, delivery_fee, status, created_at, accepted_at, delivered_at')
        .in('status', ['searching', 'accepted', 'collecting', 'delivering'])
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('id', { count: 'exact' }).eq('status', 'pending'),
    ]);

    const all = (deliveries.data ?? []) as DeliveryRow[];
    const thisWeek = all.filter(d => new Date(d.created_at) >= startOfDay(sevenDaysAgo));
    const prevWeek = all.filter(d => {
      const c = new Date(d.created_at);
      return c >= startOfDay(fourteenDaysAgo) && c < startOfDay(sevenDaysAgo);
    });

    const completed = all.filter(d => d.status === 'completed');
    const cancelled = all.filter(d => d.status === 'cancelled');
    const revenue = completed.reduce((s, d) => s + Number(d.delivery_fee), 0);
    const prevRevenue = prevWeek.filter(d => d.status === 'completed').reduce((s, d) => s + Number(d.delivery_fee), 0);

    // Avg delivery time (created → delivered)
    const deliveryTimes = completed
      .filter(d => d.delivered_at)
      .map(d => differenceInMinutes(new Date(d.delivered_at!), new Date(d.created_at)))
      .filter(m => m > 0 && m < 480);
    const avgMin = deliveryTimes.length > 0 ? Math.round(deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length) : 0;

    const total = completed.length + cancelled.length;
    const completionRate = total > 0 ? Math.round((completed.length / total) * 100) : 100;

    setMetrics({
      totalDeliveries: all.length,
      activeDrivers: drivers.count ?? 0,
      activeEstablishments: establishments.count ?? 0,
      revenue,
      completionRate,
      avgDeliveryMin: avgMin,
      prevTotal: prevWeek.length,
      prevRevenue,
    });
    setPendingApprovals(approvals.count ?? 0);

    // Chart
    const days: { day: string; entregas: number; receita: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dayStart = startOfDay(date);
      const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
      const dayDels = all.filter(d => { const c = new Date(d.created_at); return c >= dayStart && c < dayEnd; });
      days.push({
        day: format(date, 'EEE', { locale: ptBR }),
        entregas: dayDels.length,
        receita: dayDels.filter(d => d.status === 'completed').reduce((s, d) => s + Number(d.delivery_fee), 0),
      });
    }
    setChartData(days);
    setRecentDeliveries((recent.data ?? []) as DeliveryRow[]);
    setActiveDeliveries((active.data ?? []) as DeliveryRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel('admin-dashboard-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  const pctChange = (current: number, prev: number) => {
    if (prev === 0) return current > 0 ? '+100%' : '—';
    const pct = Math.round(((current - prev) / prev) * 100);
    return pct >= 0 ? `+${pct}%` : `${pct}%`;
  };

  const thisWeekTotal = chartData.reduce((s, d) => s + d.entregas, 0);

  const cards = [
    { title: 'Total Entregas', value: metrics.totalDeliveries, icon: Package, iconBg: 'bg-primary/10', iconColor: 'text-primary', sub: `${pctChange(thisWeekTotal, metrics.prevTotal)} vs semana anterior` },
    { title: 'Entregadores Online', value: metrics.activeDrivers, icon: Truck, iconBg: 'bg-success/10', iconColor: 'text-success' },
    { title: 'Faturamento', value: `R$ ${metrics.revenue.toFixed(2)}`, icon: DollarSign, iconBg: 'bg-primary/10', iconColor: 'text-primary', sub: `${pctChange(metrics.revenue, metrics.prevRevenue)} vs semana anterior` },
    { title: 'Estabelecimentos', value: metrics.activeEstablishments, icon: Users, iconBg: 'bg-warning/10', iconColor: 'text-warning' },
    { title: 'Taxa Conclusão', value: `${metrics.completionRate}%`, icon: CheckCircle, iconBg: 'bg-success/10', iconColor: 'text-success' },
    { title: 'Tempo Médio', value: metrics.avgDeliveryMin > 0 ? `${metrics.avgDeliveryMin} min` : '—', icon: Timer, iconBg: 'bg-blue-500/10', iconColor: 'text-blue-600' },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-3">
          {pendingApprovals > 0 && (
            <Link to="/admin/approvals">
              <Badge variant="destructive" className="gap-1 cursor-pointer text-sm px-3 py-1">
                <AlertCircle className="h-3.5 w-3.5" />
                {pendingApprovals} aprovação(ões) pendente(s)
              </Badge>
            </Link>
          )}
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" />
            {format(new Date(), "dd/MM/yyyy HH:mm")}
          </Badge>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(card => (
          <Card key={card.title} className="hover:shadow-md transition-shadow">
            <CardContent className="flex items-center gap-4 py-5">
              <div className={`rounded-xl p-3 ${card.iconBg}`}>
                <card.icon className={`h-5 w-5 ${card.iconColor}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{card.title}</p>
                <p className="text-2xl font-bold">{card.value}</p>
                {card.sub && <p className="text-xs text-muted-foreground mt-0.5">{card.sub}</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts + Active */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Entregas nos últimos 7 dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: '0.75rem', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: 13 }}
                  formatter={(value: number, name: string) => name === 'receita' ? [`R$ ${value.toFixed(2)}`, 'Receita'] : [value, 'Entregas']} />
                <Bar dataKey="entregas" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                <Bar dataKey="receita" fill="hsl(var(--primary) / 0.3)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="h-4 w-4 text-success" /> Entregas Ativas
              <Badge variant="secondary" className="ml-auto">{activeDeliveries.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[280px] overflow-y-auto">
            {activeDeliveries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma entrega ativa</p>
            ) : activeDeliveries.map(d => (
              <div key={d.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{d.customer_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{d.delivery_address}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${statusColor[d.status] ?? ''}`}>
                  {statusLabel[d.status]}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent Deliveries Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" /> Últimas Entregas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left p-3 font-medium">Entregador</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Endereço</th>
                  <th className="text-right p-3 font-medium">Valor</th>
                  <th className="text-center p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium hidden sm:table-cell">Data</th>
                </tr>
              </thead>
              <tbody>
                {recentDeliveries.map(d => (
                  <tr key={d.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="p-3 font-medium">{d.customer_name}</td>
                    <td className="p-3 text-muted-foreground hidden md:table-cell truncate max-w-[200px]">{d.delivery_address}</td>
                    <td className="p-3 text-right">R$ {Number(d.delivery_fee).toFixed(2)}</td>
                    <td className="p-3 text-center">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[d.status] ?? ''}`}>{statusLabel[d.status]}</span>
                    </td>
                    <td className="p-3 text-right text-muted-foreground hidden sm:table-cell">{format(new Date(d.created_at), 'dd/MM HH:mm')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
