import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Truck, Calendar, TrendingUp, TrendingDown, Receipt, PieChart as PieChartIcon } from 'lucide-react';
import { format, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import QuickStats from '@/components/QuickStats';

interface DeliveryRow {
  id: string;
  delivery_address: string;
  delivery_fee: number;
  delivered_at: string;
  driver_name: string;
}

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

const COLORS = ['hsl(358, 82%, 53%)', 'hsl(38, 92%, 50%)', 'hsl(142, 76%, 36%)', 'hsl(220, 70%, 50%)', 'hsl(280, 60%, 50%)'];

const EstablishmentFinancial = () => {
  const { user } = useAuth();
  const [feePercent, setFeePercent] = useState(10);
  const [deliveryList, setDeliveryList] = useState<DeliveryRow[]>([]);
  const [weeklyReports, setWeeklyReports] = useState<WeeklyReport[]>([]);
  const [period, setPeriod] = useState('month');
  const [totals, setTotals] = useState({ spent: 0, count: 0 });

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    const { data: est } = await supabase.from('establishments').select('id').eq('user_id', user!.id).maybeSingle();
    if (!est) return;

    const { data: settings } = await supabase.from('app_settings').select('value').eq('key', 'platform_fee_percentage').maybeSingle();
    setFeePercent(Number(settings?.value ?? 10));

    const { data: deliveries } = await supabase
      .from('deliveries')
      .select('id, delivery_address, delivery_fee, delivered_at, driver_id')
      .eq('establishment_id', est.id)
      .eq('status', 'completed')
      .order('delivered_at', { ascending: false });

    if (!deliveries) return;

    const driverIds = [...new Set(deliveries.filter(d => d.driver_id).map(d => d.driver_id!))];
    let driverNames: Record<string, string> = {};
    if (driverIds.length > 0) {
      const { data: drivers } = await supabase.from('drivers').select('id, user_id').in('id', driverIds);
      if (drivers && drivers.length > 0) {
        const userIds = drivers.map(d => d.user_id);
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
        const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) ?? []);
        for (const d of drivers) { driverNames[d.id] = profileMap.get(d.user_id) ?? 'Entregador'; }
      }
    }

    const list: DeliveryRow[] = deliveries.map(d => ({
      id: d.id,
      delivery_address: d.delivery_address,
      delivery_fee: Number(d.delivery_fee),
      delivered_at: d.delivered_at ?? '',
      driver_name: d.driver_id ? (driverNames[d.driver_id] ?? 'Entregador') : '-',
    }));

    setDeliveryList(list);
    setTotals({ spent: list.reduce((a, d) => a + d.delivery_fee, 0), count: list.length });

    const { data: reports } = await supabase
      .from('financial_weekly_reports').select('*')
      .eq('entity_type', 'establishment').eq('entity_id', est.id)
      .order('week_start', { ascending: false });
    setWeeklyReports(reports ?? []);
  };

  const filteredDeliveries = deliveryList.filter(d => {
    if (period === 'all') return true;
    const date = new Date(d.delivered_at);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    if (period === 'week') return date >= weekStart;
    if (period === 'month') return date >= monthStart;
    return true;
  });

  const periodTotal = filteredDeliveries.reduce((a, d) => a + d.delivery_fee, 0);
  const avgTicket = filteredDeliveries.length > 0 ? periodTotal / filteredDeliveries.length : 0;

  // Bar chart - weekly spending
  const barData = weeklyReports.slice(0, 8).reverse().map(r => ({
    week: format(new Date(r.week_start + 'T00:00:00'), 'dd/MM', { locale: ptBR }),
    valor: r.total_value,
  }));

  // Pie chart - deliveries by driver
  const driverCounts = new Map<string, number>();
  filteredDeliveries.forEach(d => {
    driverCounts.set(d.driver_name, (driverCounts.get(d.driver_name) ?? 0) + 1);
  });
  const pieData = Array.from(driverCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value]) => ({ name, value }));

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground px-4 pt-6 pb-10 rounded-b-3xl">
        <h1 className="text-xl font-bold">Financeiro</h1>
        <p className="text-sm text-primary-foreground/70">Taxa da plataforma: {feePercent}%</p>
      </div>

      {/* KPI Cards */}
      <div className="px-4 -mt-6">
        <QuickStats stats={[
          { label: 'Total Gasto', value: `R$${totals.spent.toFixed(0)}`, icon: DollarSign, color: 'bg-primary/10 text-primary' },
          { label: 'Entregas', value: totals.count, icon: Truck, color: 'bg-success/10 text-success' },
          { label: 'Ticket Médio', value: `R$${avgTicket.toFixed(0)}`, icon: Receipt, color: 'bg-warning/10 text-warning' },
        ]} />
      </div>

      <div className="p-4 space-y-6">
        {/* Bar Chart - Weekly */}
        {barData.length > 1 && (
          <Card>
            <CardContent className="py-4">
              <p className="text-xs font-semibold flex items-center gap-1 mb-3">
                <TrendingUp className="h-3.5 w-3.5 text-primary" /> Gastos por semana
              </p>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={barData}>
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: number) => [`R$ ${v.toFixed(2)}`, 'Valor']} />
                  <Bar dataKey="valor" fill="hsl(358, 82%, 53%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Pie Chart - Drivers */}
        {pieData.length > 1 && (
          <Card>
            <CardContent className="py-4">
              <p className="text-xs font-semibold flex items-center gap-1 mb-3">
                <PieChartIcon className="h-3.5 w-3.5 text-primary" /> Entregas por entregador
              </p>
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" innerRadius={30} outerRadius={55} paddingAngle={2}>
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1">
                  {pieData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="flex-1 truncate">{d.name}</span>
                      <span className="font-medium">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Deliveries Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Entregas</h2>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Semana</SelectItem>
                <SelectItem value="month">Mês</SelectItem>
                <SelectItem value="all">Tudo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Data</TableHead>
                    <TableHead className="text-xs">Endereço</TableHead>
                    <TableHead className="text-xs">Entregador</TableHead>
                    <TableHead className="text-right text-xs">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDeliveries.slice(0, 20).map(d => (
                    <TableRow key={d.id}>
                      <TableCell className="text-xs">{d.delivered_at ? format(new Date(d.delivered_at), 'dd/MM HH:mm', { locale: ptBR }) : '-'}</TableCell>
                      <TableCell className="text-xs truncate max-w-[120px]">{d.delivery_address}</TableCell>
                      <TableCell className="text-xs">{d.driver_name}</TableCell>
                      <TableCell className="text-right text-xs font-medium">R$ {d.delivery_fee.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  {filteredDeliveries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-6">Nenhuma entrega no período</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          {filteredDeliveries.length > 0 && (
            <p className="text-xs text-muted-foreground text-right">
              Total: R$ {periodTotal.toFixed(2)} · {filteredDeliveries.length} entregas
            </p>
          )}
        </div>

        {/* Weekly Reports */}
        {weeklyReports.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Relatórios Semanais
            </h2>
            <div className="space-y-2">
              {weeklyReports.map(r => (
                <Card key={r.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {format(new Date(r.week_start + 'T00:00:00'), 'dd/MM', { locale: ptBR })} - {format(new Date(r.week_end + 'T00:00:00'), 'dd/MM', { locale: ptBR })}
                      </p>
                      <p className="text-xs text-muted-foreground">{r.total_deliveries} entregas · Taxa: R$ {r.platform_fee.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">R$ {r.total_value.toFixed(2)}</p>
                      <Badge variant={r.status === 'paid' ? 'default' : 'secondary'} className="text-xs">
                        {r.status === 'paid' ? 'Pago' : 'Pendente'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EstablishmentFinancial;
