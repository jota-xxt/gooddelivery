import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, DollarSign, TrendingUp, Truck, CheckCircle, BarChart3 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface WeeklyReport {
  id: string;
  week_start: string;
  week_end: string;
  entity_type: string;
  entity_id: string;
  total_deliveries: number;
  total_value: number;
  platform_fee: number;
  net_payout: number;
  status: string;
  entity_name?: string;
}

const AdminFinancial = () => {
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [weeks, setWeeks] = useState<string[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>('all');
  const [feePercent, setFeePercent] = useState(10);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);

    const { data: settings } = await supabase
      .from('app_settings').select('value').eq('key', 'platform_fee_percentage').maybeSingle();
    setFeePercent(Number(settings?.value ?? 10));

    const { data: rawReports } = await supabase
      .from('financial_weekly_reports').select('*').order('week_start', { ascending: false });

    if (!rawReports) { setLoading(false); return; }

    const uniqueWeeks = [...new Set(rawReports.map(r => r.week_start))];
    setWeeks(uniqueWeeks);

    const estIds = rawReports.filter(r => r.entity_type === 'establishment').map(r => r.entity_id);
    const driverIds = rawReports.filter(r => r.entity_type === 'driver').map(r => r.entity_id);

    const [{ data: ests }, { data: drivers }] = await Promise.all([
      estIds.length > 0
        ? supabase.from('establishments').select('id, business_name').in('id', estIds)
        : Promise.resolve({ data: [] as { id: string; business_name: string }[] }),
      driverIds.length > 0
        ? supabase.from('drivers').select('id, user_id').in('id', driverIds)
        : Promise.resolve({ data: [] as { id: string; user_id: string }[] }),
    ]);

    let driverNames: Record<string, string> = {};
    if (drivers && drivers.length > 0) {
      const userIds = drivers.map(d => d.user_id);
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
      const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) ?? []);
      for (const d of drivers) { driverNames[d.id] = profileMap.get(d.user_id) ?? 'Entregador'; }
    }

    const estMap = new Map(ests?.map(e => [e.id, e.business_name]) ?? []);
    setReports(rawReports.map(r => ({
      ...r,
      entity_name: r.entity_type === 'establishment'
        ? estMap.get(r.entity_id) ?? 'Desconhecido'
        : driverNames[r.entity_id] ?? 'Desconhecido',
    })));
    setLoading(false);
  };

  const filtered = useMemo(() => {
    if (selectedWeek === 'all') return reports;
    return reports.filter(r => r.week_start === selectedWeek);
  }, [reports, selectedWeek]);

  const estReports = filtered.filter(r => r.entity_type === 'establishment');
  const driverReports = filtered.filter(r => r.entity_type === 'driver');

  const totals = useMemo(() =>
    filtered.reduce((a, r) => ({
      deliveries: a.deliveries + r.total_deliveries,
      value: a.value + r.total_value,
      fee: a.fee + r.platform_fee,
      payout: a.payout + r.net_payout,
    }), { deliveries: 0, value: 0, fee: 0, payout: 0 }),
  [filtered]);

  // Chart data: aggregate by week
  const chartData = useMemo(() => {
    const map = new Map<string, { semana: string; receita: number; taxa: number }>();
    reports.forEach(r => {
      const key = r.week_start;
      const existing = map.get(key) ?? { semana: '', receita: 0, taxa: 0 };
      const d = new Date(key + 'T00:00:00');
      existing.semana = format(d, 'dd/MM', { locale: ptBR });
      existing.receita += r.total_value;
      existing.taxa += r.platform_fee;
      map.set(key, existing);
    });
    return [...map.values()].reverse().slice(-8);
  }, [reports]);

  const markAsPaid = async (id: string) => {
    const { error } = await supabase.from('financial_weekly_reports').update({ status: 'paid' }).eq('id', id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    setReports(prev => prev.map(r => r.id === id ? { ...r, status: 'paid' } : r));
    toast({ title: 'Marcado como pago' });
  };

  const exportCSV = (data: WeeklyReport[], filename: string) => {
    const header = 'Nome,Tipo,Semana,Entregas,Valor Total,Taxa Plataforma,Repasse Líquido,Status\n';
    const rows = data.map(r =>
      `"${r.entity_name}","${r.entity_type}","${r.week_start} a ${r.week_end}",${r.total_deliveries},${r.total_value.toFixed(2)},${r.platform_fee.toFixed(2)},${r.net_payout.toFixed(2)},"${r.status}"`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${filename}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const formatWeek = (ws: string) => {
    const d = new Date(ws + 'T00:00:00');
    return format(d, "'Semana de' dd/MM", { locale: ptBR });
  };

  const metricCards = [
    { title: 'Total Entregas', value: String(totals.deliveries), icon: Truck, iconBg: 'bg-blue-500/10', iconColor: 'text-blue-600' },
    { title: 'Receita Bruta', value: `R$ ${totals.value.toFixed(2)}`, icon: DollarSign, iconBg: 'bg-success/10', iconColor: 'text-success' },
    { title: `Taxa (${feePercent}%)`, value: `R$ ${totals.fee.toFixed(2)}`, icon: TrendingUp, iconBg: 'bg-primary/10', iconColor: 'text-primary' },
    { title: 'Repasse Total', value: `R$ ${totals.payout.toFixed(2)}`, icon: DollarSign, iconBg: 'bg-warning/10', iconColor: 'text-warning' },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  const ReportTable = ({ data, type }: { data: WeeklyReport[]; type: string }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">{type === 'establishment' ? 'Estabelecimentos' : 'Entregadores'}</CardTitle>
        <Button variant="outline" size="sm" onClick={() => exportCSV(data, `relatorio-${type}`)}>
          <Download className="h-4 w-4 mr-1" /> CSV
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="text-right">Entregas</TableHead>
              <TableHead className="text-right">Valor Bruto</TableHead>
              <TableHead className="text-right">Taxa</TableHead>
              <TableHead className="text-right">Líquido</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map(row => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.entity_name}</TableCell>
                <TableCell className="text-right">{row.total_deliveries}</TableCell>
                <TableCell className="text-right">R$ {row.total_value.toFixed(2)}</TableCell>
                <TableCell className="text-right">R$ {row.platform_fee.toFixed(2)}</TableCell>
                <TableCell className="text-right">R$ {row.net_payout.toFixed(2)}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={row.status === 'paid' ? 'default' : 'secondary'}>
                    {row.status === 'paid' ? 'Pago' : 'Pendente'}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  {row.status === 'pending' && (
                    <Button size="sm" variant="ghost" onClick={() => markAsPaid(row.id)}>
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {data.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum relatório encontrado</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Relatório Financeiro</h1>
        <Select value={selectedWeek} onValueChange={setSelectedWeek}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os períodos</SelectItem>
            {weeks.map(w => <SelectItem key={w} value={w}>{formatWeek(w)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map(c => (
          <Card key={c.title} className="hover:shadow-md transition-shadow">
            <CardContent className="flex items-center gap-4 py-5">
              <div className={`rounded-xl p-3 ${c.iconBg}`}>
                <c.icon className={`h-5 w-5 ${c.iconColor}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{c.title}</p>
                <p className="text-2xl font-bold">{c.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Receita por Semana
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="semana" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    borderRadius: '0.75rem',
                    border: '1px solid hsl(var(--border))',
                    background: 'hsl(var(--card))',
                    fontSize: 13,
                  }}
                  formatter={(v: number, name: string) => [
                    `R$ ${v.toFixed(2)}`,
                    name === 'receita' ? 'Receita' : 'Taxa',
                  ]}
                />
                <Bar dataKey="receita" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                <Bar dataKey="taxa" fill="hsl(var(--primary) / 0.3)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="establishments">
        <TabsList>
          <TabsTrigger value="establishments">Por Estabelecimento</TabsTrigger>
          <TabsTrigger value="drivers">Por Entregador</TabsTrigger>
        </TabsList>
        <TabsContent value="establishments">
          <ReportTable data={estReports} type="establishment" />
        </TabsContent>
        <TabsContent value="drivers">
          <ReportTable data={driverReports} type="driver" />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminFinancial;
