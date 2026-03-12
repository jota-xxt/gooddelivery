import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Download, DollarSign, TrendingUp, Truck, CheckCircle, BarChart3,
  Search, AlertCircle, RefreshCw, Receipt, Calendar, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, startOfWeek, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';

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

interface DeliverySummary {
  total: number;
  completed: number;
  cancelled: number;
  searching: number;
  revenue: number;
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  dailyData: { day: string; valor: number; entregas: number }[];
}

const PIE_COLORS = ['hsl(358, 82%, 53%)', 'hsl(142, 76%, 36%)', 'hsl(38, 92%, 50%)'];

const AdminFinancial = () => {
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [weeks, setWeeks] = useState<string[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>('all');
  const [entitySearch, setEntitySearch] = useState('');
  const [feePercent, setFeePercent] = useState(10);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [summary, setSummary] = useState<DeliverySummary>({
    total: 0, completed: 0, cancelled: 0, searching: 0,
    revenue: 0, todayRevenue: 0, weekRevenue: 0, monthRevenue: 0, dailyData: [],
  });
  const { toast } = useToast();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadReports(), loadDeliverySummary()]);
    setLoading(false);
  };

  const loadDeliverySummary = async () => {
    const { data: settings } = await supabase.from('app_settings').select('value').eq('key', 'platform_fee_percentage').maybeSingle();
    setFeePercent(Number(settings?.value ?? 10));

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const { data: deliveries } = await supabase
      .from('deliveries')
      .select('id, delivery_fee, status, delivered_at, created_at')
      .gte('created_at', ninetyDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (!deliveries) return;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = startOfWeek(now, { weekStartsOn: 0 });
    const monthStart = startOfMonth(now);

    const completed = deliveries.filter(d => d.status === 'completed');
    const revenue = completed.reduce((s, d) => s + Number(d.delivery_fee), 0);

    const todayRevenue = completed
      .filter(d => d.delivered_at && new Date(d.delivered_at) >= todayStart)
      .reduce((s, d) => s + Number(d.delivery_fee), 0);

    const weekRevenue = completed
      .filter(d => d.delivered_at && new Date(d.delivered_at) >= weekStart)
      .reduce((s, d) => s + Number(d.delivery_fee), 0);

    const monthRevenue = completed
      .filter(d => d.delivered_at && new Date(d.delivered_at) >= monthStart)
      .reduce((s, d) => s + Number(d.delivery_fee), 0);

    // Build last 14 days chart
    const dailyMap = new Map<string, { valor: number; entregas: number }>();
    for (let i = 13; i >= 0; i--) {
      const d = subDays(now, i);
      const key = format(d, 'dd/MM');
      dailyMap.set(key, { valor: 0, entregas: 0 });
    }
    completed.forEach(d => {
      if (!d.delivered_at) return;
      const key = format(new Date(d.delivered_at), 'dd/MM');
      const existing = dailyMap.get(key);
      if (existing) {
        existing.valor += Number(d.delivery_fee);
        existing.entregas += 1;
      }
    });

    setSummary({
      total: deliveries.length,
      completed: completed.length,
      cancelled: deliveries.filter(d => d.status === 'cancelled').length,
      searching: deliveries.filter(d => d.status === 'searching').length,
      revenue,
      todayRevenue,
      weekRevenue,
      monthRevenue,
      dailyData: Array.from(dailyMap.entries()).map(([day, v]) => ({ day, ...v })),
    });
  };

  const loadReports = async () => {
    const { data: rawReports } = await supabase.from('financial_weekly_reports').select('*').order('week_start', { ascending: false });
    if (!rawReports || rawReports.length === 0) { setReports([]); return; }

    const uniqueWeeks = [...new Set(rawReports.map(r => r.week_start))];
    setWeeks(uniqueWeeks);

    const estIds = rawReports.filter(r => r.entity_type === 'establishment').map(r => r.entity_id);
    const driverIds = rawReports.filter(r => r.entity_type === 'driver').map(r => r.entity_id);

    const [{ data: ests }, { data: drivers }] = await Promise.all([
      estIds.length > 0 ? supabase.from('establishments').select('id, business_name').in('id', estIds) : Promise.resolve({ data: [] as any[] }),
      driverIds.length > 0 ? supabase.from('drivers').select('id, user_id').in('id', driverIds) : Promise.resolve({ data: [] as any[] }),
    ]);

    let driverNames: Record<string, string> = {};
    if (drivers && drivers.length > 0) {
      const userIds = drivers.map((d: any) => d.user_id);
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
      const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) ?? []);
      for (const d of drivers) { driverNames[d.id] = profileMap.get(d.user_id) ?? 'Entregador'; }
    }

    const estMap = new Map<string, string>(ests?.map((e: any) => [e.id, e.business_name] as [string, string]) ?? []);
    setReports(rawReports.map(r => ({
      ...r,
      entity_name: r.entity_type === 'establishment' ? (estMap.get(r.entity_id) ?? 'Desconhecido') : (driverNames[r.entity_id] ?? 'Desconhecido'),
    })));
  };

  const generateReport = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-weekly-report');
      if (error) throw error;
      toast({ title: 'Relatório gerado', description: data?.message || 'Relatórios semanais atualizados.' });
      await loadReports();
    } catch (err: any) {
      toast({ title: 'Erro ao gerar relatório', description: err.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const filtered = useMemo(() => {
    let result = selectedWeek === 'all' ? reports : reports.filter(r => r.week_start === selectedWeek);
    if (entitySearch) {
      const q = entitySearch.toLowerCase();
      result = result.filter(r => r.entity_name?.toLowerCase().includes(q));
    }
    return result;
  }, [reports, selectedWeek, entitySearch]);

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

  const pendingCount = useMemo(() => filtered.filter(r => r.status === 'pending').length, [filtered]);

  const pieData = useMemo(() => {
    const estPayout = estReports.reduce((s, r) => s + r.net_payout, 0);
    const driverPayout = driverReports.reduce((s, r) => s + r.net_payout, 0);
    return [
      { name: 'Plataforma', value: Number(totals.fee.toFixed(2)) },
      { name: 'Entregadores', value: Number(driverPayout.toFixed(2)) },
      { name: 'Estabelecimentos', value: Number(estPayout.toFixed(2)) },
    ].filter(d => d.value > 0);
  }, [totals, estReports, driverReports]);

  const chartData = useMemo(() => {
    const map = new Map<string, { semana: string; receita: number; taxa: number }>();
    reports.forEach(r => {
      const key = r.week_start;
      const existing = map.get(key) ?? { semana: '', receita: 0, taxa: 0 };
      existing.semana = format(new Date(key + 'T00:00:00'), 'dd/MM', { locale: ptBR });
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
    const a = document.createElement('a'); a.href = url; a.download = `${filename}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const formatWeek = (ws: string) => format(new Date(ws + 'T00:00:00'), "'Semana de' dd/MM", { locale: ptBR });

  const fmt = (v: number) => v >= 1000 ? `R$ ${(v / 1000).toFixed(1)}k` : `R$ ${v.toFixed(0)}`;

  if (loading) {
    return (
      <div className="space-y-6 p-1">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
        <Skeleton className="h-56 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Financeiro</h1>
          <p className="text-sm text-muted-foreground">Taxa da plataforma: {feePercent}%</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={generateReport} disabled={generating} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Gerando...' : 'Gerar Relatório'}
          </Button>
          {pendingCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertCircle className="h-3 w-3" /> {pendingCount}
            </Badge>
          )}
        </div>
      </div>

      {/* Live KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Receita Total</span>
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
            <p className="text-xl font-bold">{fmt(summary.revenue)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{summary.completed} entregas completas</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Hoje</span>
              <ArrowUpRight className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-xl font-bold">{fmt(summary.todayRevenue)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Semana: {fmt(summary.weekRevenue)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Mês</span>
              <Calendar className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-xl font-bold">{fmt(summary.monthRevenue)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Taxa estimada: {fmt(summary.monthRevenue * feePercent / 100)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-rose-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Status</span>
              <Truck className="h-4 w-4 text-rose-500" />
            </div>
            <p className="text-xl font-bold">{summary.total}</p>
            <div className="flex gap-2 mt-1">
              <span className="text-[10px] text-green-600">{summary.completed} ✓</span>
              <span className="text-[10px] text-red-500">{summary.cancelled} ✗</span>
              <span className="text-[10px] text-amber-500">{summary.searching} 🔍</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Area Chart */}
      {summary.dailyData.some(d => d.valor > 0) && (
        <Card>
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Receita diária (14 dias)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={summary.dailyData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(358, 82%, 53%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(358, 82%, 53%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(0, 0%, 90%)" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(0, 0%, 45%)" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(0, 0%, 45%)" width={50} />
                <Tooltip
                  contentStyle={{ borderRadius: '0.75rem', border: '1px solid hsl(0, 0%, 90%)', background: 'hsl(0, 0%, 100%)', fontSize: 12 }}
                  formatter={(v: number, name: string) => [`R$ ${v.toFixed(2)}`, name === 'valor' ? 'Receita' : 'Entregas']}
                />
                <Area type="monotone" dataKey="valor" stroke="hsl(358, 82%, 53%)" fill="url(#colorRevenue)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Weekly Reports Section */}
      {reports.length > 0 && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Receipt className="h-4 w-4" /> Relatórios Semanais
            </h2>
            <Select value={selectedWeek} onValueChange={setSelectedWeek}>
              <SelectTrigger className="w-full sm:w-[200px] h-9 text-xs">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os períodos</SelectItem>
                {weeks.map(w => <SelectItem key={w} value={w}>{formatWeek(w)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Report KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Entregas', value: String(totals.deliveries), icon: Truck, color: 'text-blue-600' },
              { label: 'Receita Bruta', value: `R$ ${totals.value.toFixed(2)}`, icon: DollarSign, color: 'text-green-600' },
              { label: `Taxa (${feePercent}%)`, value: `R$ ${totals.fee.toFixed(2)}`, icon: TrendingUp, color: 'text-primary' },
              { label: 'Repasse', value: `R$ ${totals.payout.toFixed(2)}`, icon: ArrowDownRight, color: 'text-amber-600' },
            ].map(c => (
              <Card key={c.label}>
                <CardContent className="p-3 flex items-center gap-3">
                  <c.icon className={`h-5 w-5 ${c.color} shrink-0`} />
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground truncate">{c.label}</p>
                    <p className="text-sm font-bold">{c.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {chartData.length > 1 && (
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2 px-4 pt-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" /> Receita por Semana
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-2 pb-3">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(0, 0%, 90%)" />
                      <XAxis dataKey="semana" tick={{ fontSize: 11 }} stroke="hsl(0, 0%, 45%)" />
                      <YAxis tick={{ fontSize: 11 }} stroke="hsl(0, 0%, 45%)" />
                      <Tooltip
                        contentStyle={{ borderRadius: '0.75rem', border: '1px solid hsl(0, 0%, 90%)', background: 'hsl(0, 0%, 100%)', fontSize: 12 }}
                        formatter={(v: number, name: string) => [`R$ ${v.toFixed(2)}`, name === 'receita' ? 'Receita' : 'Taxa']}
                      />
                      <Bar dataKey="receita" fill="hsl(358, 82%, 53%)" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="taxa" fill="hsl(358, 82%, 53%, 0.3)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {pieData.length > 0 && (
              <Card>
                <CardHeader className="pb-2 px-4 pt-4">
                  <CardTitle className="text-sm">Distribuição</CardTitle>
                </CardHeader>
                <CardContent className="px-2 pb-3">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={4} dataKey="value">
                        {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center gap-4 mt-1">
                    {pieData.map((d, i) => (
                      <div key={d.name} className="flex items-center gap-1.5 text-[10px]">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        {d.name}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Search + Table */}
          <div className="relative max-w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Filtrar por nome..." value={entitySearch} onChange={e => setEntitySearch(e.target.value)} className="pl-10 h-9 text-sm" />
          </div>

          <Tabs defaultValue="establishments">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="establishments" className="flex-1 sm:flex-none text-xs">Estabelecimentos</TabsTrigger>
              <TabsTrigger value="drivers" className="flex-1 sm:flex-none text-xs">Entregadores</TabsTrigger>
            </TabsList>
            <TabsContent value="establishments"><ReportTable data={estReports} markAsPaid={markAsPaid} exportCSV={exportCSV} type="establishment" /></TabsContent>
            <TabsContent value="drivers"><ReportTable data={driverReports} markAsPaid={markAsPaid} exportCSV={exportCSV} type="driver" /></TabsContent>
          </Tabs>
        </>
      )}

      {/* Empty state for reports */}
      {reports.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <Receipt className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-medium">Nenhum relatório semanal</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Clique em "Gerar Relatório" para consolidar as entregas da última semana.
            </p>
            <Button size="sm" onClick={generateReport} disabled={generating} className="gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${generating ? 'animate-spin' : ''}`} />
              Gerar Agora
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const ReportTable = ({ data, type, markAsPaid, exportCSV }: {
  data: WeeklyReport[];
  type: string;
  markAsPaid: (id: string) => void;
  exportCSV: (data: WeeklyReport[], filename: string) => void;
}) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4">
      <CardTitle className="text-sm">{type === 'establishment' ? 'Estabelecimentos' : 'Entregadores'}</CardTitle>
      <Button variant="outline" size="sm" onClick={() => exportCSV(data, `relatorio-${type}`)} className="h-7 text-xs gap-1">
        <Download className="h-3 w-3" /> CSV
      </Button>
    </CardHeader>
    <CardContent className="p-0 overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Nome</TableHead>
            <TableHead className="text-right text-xs">Entregas</TableHead>
            <TableHead className="text-right text-xs hidden sm:table-cell">Bruto</TableHead>
            <TableHead className="text-right text-xs hidden sm:table-cell">Taxa</TableHead>
            <TableHead className="text-right text-xs">Líquido</TableHead>
            <TableHead className="text-center text-xs">Status</TableHead>
            <TableHead className="text-center text-xs w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map(row => (
            <TableRow key={row.id}>
              <TableCell className="text-xs font-medium max-w-[120px] truncate">{row.entity_name}</TableCell>
              <TableCell className="text-right text-xs">{row.total_deliveries}</TableCell>
              <TableCell className="text-right text-xs hidden sm:table-cell">R$ {row.total_value.toFixed(2)}</TableCell>
              <TableCell className="text-right text-xs hidden sm:table-cell">R$ {row.platform_fee.toFixed(2)}</TableCell>
              <TableCell className="text-right text-xs font-medium">R$ {row.net_payout.toFixed(2)}</TableCell>
              <TableCell className="text-center">
                <Badge variant={row.status === 'paid' ? 'default' : 'secondary'} className="text-[10px]">
                  {row.status === 'paid' ? 'Pago' : 'Pendente'}
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                {row.status === 'pending' && (
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => markAsPaid(row.id)}>
                    <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
          {data.length === 0 && (
            <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8 text-xs">Nenhum relatório</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </CardContent>
  </Card>
);

export default AdminFinancial;
