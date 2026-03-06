import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, TrendingUp, Truck, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DeliveryRow {
  id: string;
  customer_name: string;
  delivery_fee: number;
  delivered_at: string;
  establishment_name: string;
  net: number;
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

const DriverEarnings = () => {
  const { user } = useAuth();
  const [earnings, setEarnings] = useState({ today: 0, week: 0, month: 0, total: 0, deliveries: 0 });
  const [feePercent, setFeePercent] = useState(10);
  const [deliveryList, setDeliveryList] = useState<DeliveryRow[]>([]);
  const [weeklyReports, setWeeklyReports] = useState<WeeklyReport[]>([]);
  const [period, setPeriod] = useState('week');

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    const { data: driver } = await supabase.from('drivers').select('id').eq('user_id', user!.id).single();
    if (!driver) return;

    const { data: settings } = await supabase.from('app_settings').select('value').eq('key', 'platform_fee_percentage').single();
    const fee = Number(settings?.value ?? 10);
    setFeePercent(fee);

    // Completed deliveries
    const { data: deliveries } = await supabase
      .from('deliveries')
      .select('id, customer_name, delivery_fee, delivered_at, establishment_id')
      .eq('driver_id', driver.id)
      .eq('status', 'completed')
      .order('delivered_at', { ascending: false });

    if (!deliveries) return;

    // Get establishment names
    const estIds = [...new Set(deliveries.map(d => d.establishment_id))];
    let ests: { id: string; business_name: string }[] = [];
    if (estIds.length > 0) {
      const { data } = await supabase.from('establishments').select('id, business_name').in('id', estIds);
      ests = data ?? [];
    }
    const estMap = new Map(ests.map(e => [e.id, e.business_name]));

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let today = 0, week = 0, month = 0, total = 0;
    const list: DeliveryRow[] = [];

    for (const d of deliveries) {
      const net = Number(d.delivery_fee) * (1 - fee / 100);
      const date = new Date(d.delivered_at ?? '');
      total += net;
      if (date >= todayStart) today += net;
      if (date >= weekStart) week += net;
      if (date >= monthStart) month += net;

      list.push({
        id: d.id,
        customer_name: d.customer_name,
        delivery_fee: Number(d.delivery_fee),
        delivered_at: d.delivered_at ?? '',
        establishment_name: estMap.get(d.establishment_id) ?? 'Desconhecido',
        net,
      });
    }

    setEarnings({ today, week, month, total, deliveries: deliveries.length });
    setDeliveryList(list);

    // Weekly reports
    const { data: reports } = await supabase
      .from('financial_weekly_reports')
      .select('*')
      .eq('entity_type', 'driver')
      .eq('entity_id', driver.id)
      .order('week_start', { ascending: false });

    setWeeklyReports(reports ?? []);
  };

  const filteredDeliveries = deliveryList.filter(d => {
    const date = new Date(d.delivered_at);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    if (period === 'today') return date >= todayStart;
    if (period === 'week') return date >= weekStart;
    if (period === 'month') return date >= monthStart;
    return true;
  });

  return (
    <div className="p-4 space-y-6 pb-24">
      <h1 className="text-2xl font-bold">Meus Ganhos</h1>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Hoje</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">R$ {earnings.today.toFixed(2)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Semana</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">R$ {earnings.week.toFixed(2)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Mês</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">R$ {earnings.month.toFixed(2)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold flex items-center gap-1"><DollarSign className="h-4 w-4 text-primary" />R$ {earnings.total.toFixed(2)}</p></CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground text-center">Taxa da plataforma: {feePercent}%</p>

      {/* Delivery list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Entregas</h2>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px]">
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

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Estabelecimento</TableHead>
                  <TableHead className="text-right">Bruto</TableHead>
                  <TableHead className="text-right">Líquido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeliveries.map(d => (
                  <TableRow key={d.id}>
                    <TableCell className="text-xs">
                      {d.delivered_at ? format(new Date(d.delivered_at), 'dd/MM HH:mm', { locale: ptBR }) : '-'}
                    </TableCell>
                    <TableCell className="text-xs">{d.establishment_name}</TableCell>
                    <TableCell className="text-right text-xs">R$ {d.delivery_fee.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-xs font-medium">R$ {d.net.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                {filteredDeliveries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                      Nenhuma entrega no período
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Weekly reports */}
      {weeklyReports.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5" /> Relatórios Semanais
          </h2>
          <div className="space-y-2">
            {weeklyReports.map(r => (
              <Card key={r.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {format(new Date(r.week_start + 'T00:00:00'), 'dd/MM', { locale: ptBR })} - {format(new Date(r.week_end + 'T00:00:00'), 'dd/MM', { locale: ptBR })}
                    </p>
                    <p className="text-xs text-muted-foreground">{r.total_deliveries} entregas</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">R$ {r.net_payout.toFixed(2)}</p>
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
  );
};

export default DriverEarnings;
