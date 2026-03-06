import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Truck, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DeliveryRow {
  id: string;
  customer_name: string;
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
    const { data: est } = await supabase.from('establishments').select('id').eq('user_id', user!.id).single();
    if (!est) return;

    const { data: settings } = await supabase.from('app_settings').select('value').eq('key', 'platform_fee_percentage').single();
    setFeePercent(Number(settings?.value ?? 10));

    const { data: deliveries } = await supabase
      .from('deliveries')
      .select('id, customer_name, delivery_fee, delivered_at, driver_id')
      .eq('establishment_id', est.id)
      .eq('status', 'completed')
      .order('delivered_at', { ascending: false });

    if (!deliveries) return;

    // Get driver names
    const driverIds = [...new Set(deliveries.filter(d => d.driver_id).map(d => d.driver_id!))];
    let driverNames: Record<string, string> = {};
    if (driverIds.length > 0) {
      const { data: drivers } = await supabase.from('drivers').select('id, user_id').in('id', driverIds);
      if (drivers && drivers.length > 0) {
        const userIds = drivers.map(d => d.user_id);
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
        const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) ?? []);
        for (const d of drivers) {
          driverNames[d.id] = profileMap.get(d.user_id) ?? 'Entregador';
        }
      }
    }

    const list: DeliveryRow[] = deliveries.map(d => ({
      id: d.id,
      customer_name: d.customer_name,
      delivery_fee: Number(d.delivery_fee),
      delivered_at: d.delivered_at ?? '',
      driver_name: d.driver_id ? (driverNames[d.driver_id] ?? 'Entregador') : '-',
    }));

    setDeliveryList(list);
    setTotals({
      spent: list.reduce((a, d) => a + d.delivery_fee, 0),
      count: list.length,
    });

    // Weekly reports
    const { data: reports } = await supabase
      .from('financial_weekly_reports')
      .select('*')
      .eq('entity_type', 'establishment')
      .eq('entity_id', est.id)
      .order('week_start', { ascending: false });

    setWeeklyReports(reports ?? []);
  };

  const filteredDeliveries = deliveryList.filter(d => {
    if (period === 'all') return true;
    const date = new Date(d.delivered_at);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    if (period === 'week') return date >= weekStart;
    if (period === 'month') return date >= monthStart;
    return true;
  });

  const periodTotal = filteredDeliveries.reduce((a, d) => a + d.delivery_fee, 0);

  return (
    <div className="p-4 space-y-6 pb-24">
      <h1 className="text-2xl font-bold">Financeiro</h1>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Gasto</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xl font-bold flex items-center gap-1">
              <DollarSign className="h-4 w-4 text-primary" />R$ {totals.spent.toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Entregas</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xl font-bold flex items-center gap-1">
              <Truck className="h-4 w-4 text-primary" />{totals.count}
            </p>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground text-center">Taxa da plataforma: {feePercent}%</p>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Entregas</h2>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px]">
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
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Entregador</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeliveries.map(d => (
                  <TableRow key={d.id}>
                    <TableCell className="text-xs">
                      {d.delivered_at ? format(new Date(d.delivered_at), 'dd/MM HH:mm', { locale: ptBR }) : '-'}
                    </TableCell>
                    <TableCell className="text-xs">{d.customer_name}</TableCell>
                    <TableCell className="text-xs">{d.driver_name}</TableCell>
                    <TableCell className="text-right text-xs font-medium">R$ {d.delivery_fee.toFixed(2)}</TableCell>
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
        <p className="text-xs text-muted-foreground text-right">Total no período: R$ {periodTotal.toFixed(2)}</p>
      </div>

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
  );
};

export default EstablishmentFinancial;
