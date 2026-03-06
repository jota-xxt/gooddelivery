import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, TrendingUp, Truck, Calendar, Wallet } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

interface WeeklyReport {
  id: string;
  week_start: string;
  week_end: string;
  total_deliveries: number;
  total_value: number;
  platform_fee: number;
  net_payout: number;
  status: string;
}

const DriverEarnings = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [earnings, setEarnings] = useState({ today: 0, week: 0, month: 0, total: 0, totalDeliveries: 0 });
  const [feePercent, setFeePercent] = useState(10);
  const [chartData, setChartData] = useState<{ day: string; value: number }[]>([]);
  const [weeklyReports, setWeeklyReports] = useState<WeeklyReport[]>([]);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    const { data: driver } = await supabase.from('drivers').select('id').eq('user_id', user!.id).maybeSingle();
    if (!driver) { setLoading(false); return; }

    const { data: settings } = await supabase.from('app_settings').select('value').eq('key', 'platform_fee_percentage').maybeSingle();
    const fee = Number(settings?.value ?? 10);
    setFeePercent(fee);

    const { data: deliveries } = await supabase
      .from('deliveries')
      .select('delivery_fee, delivered_at')
      .eq('driver_id', driver.id)
      .eq('status', 'completed')
      .order('delivered_at', { ascending: false });

    if (!deliveries) { setLoading(false); return; }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let today = 0, week = 0, month = 0, total = 0;
    for (const d of deliveries) {
      const net = Number(d.delivery_fee) * (1 - fee / 100);
      const date = new Date(d.delivered_at ?? '');
      total += net;
      if (date >= todayStart) today += net;
      if (date >= weekStart) week += net;
      if (date >= monthStart) month += net;
    }
    setEarnings({ today, week, month, total, totalDeliveries: deliveries.length });

    // Chart data - last 7 days
    const days: { day: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(now, i);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const dayTotal = deliveries
        .filter(d => { const dt = new Date(d.delivered_at ?? ''); return dt >= dayStart && dt < dayEnd; })
        .reduce((s, d) => s + Number(d.delivery_fee) * (1 - fee / 100), 0);
      days.push({ day: format(date, 'EEE', { locale: ptBR }), value: Number(dayTotal.toFixed(2)) });
    }
    setChartData(days);

    // Weekly reports
    const { data: reports } = await supabase
      .from('financial_weekly_reports')
      .select('*')
      .eq('entity_type', 'driver')
      .eq('entity_id', driver.id)
      .order('week_start', { ascending: false });
    setWeeklyReports(reports ?? []);

    setLoading(false);
  };

  const summaryCards = [
    { label: 'Hoje', value: earnings.today, icon: DollarSign, color: 'bg-green-500/10 text-green-600' },
    { label: 'Semana', value: earnings.week, icon: TrendingUp, color: 'bg-blue-500/10 text-blue-600' },
    { label: 'Mês', value: earnings.month, icon: Wallet, color: 'bg-purple-500/10 text-purple-600' },
    { label: 'Total', value: earnings.total, icon: Truck, color: 'bg-primary/10 text-primary' },
  ];

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <Skeleton className="h-48 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 pb-24">
      <h1 className="text-xl font-bold">Meus Ganhos</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        {summaryCards.map(c => {
          const Icon = c.icon;
          return (
            <Card key={c.label}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${c.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-xs text-muted-foreground">{c.label}</span>
                </div>
                <p className="text-xl font-bold">R$ {c.value.toFixed(2)}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center">Taxa da plataforma: {feePercent}% · {earnings.totalDeliveries} entregas no total</p>

      {/* Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Últimos 7 dias</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="day" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={45} tickFormatter={v => `R$${v}`} />
                <Tooltip formatter={(v: number) => [`R$ ${v.toFixed(2)}`, 'Ganho']} />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Weekly reports */}
      {weeklyReports.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5" /> Relatórios Semanais
          </h2>
          <div className="space-y-2">
            {weeklyReports.map(r => (
              <Card key={r.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">
                      {format(new Date(r.week_start + 'T00:00:00'), 'dd/MM', { locale: ptBR })} - {format(new Date(r.week_end + 'T00:00:00'), 'dd/MM', { locale: ptBR })}
                    </p>
                    <Badge variant={r.status === 'paid' ? 'default' : 'secondary'} className="text-xs">
                      {r.status === 'paid' ? 'Pago' : 'Pendente'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{r.total_deliveries} entregas</span>
                    <span className="text-lg font-bold">R$ {r.net_payout.toFixed(2)}</span>
                  </div>
                  {/* Simple progress bar for payment status */}
                  <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${r.status === 'paid' ? 'bg-green-500 w-full' : 'bg-primary w-1/2'}`} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverEarnings;
