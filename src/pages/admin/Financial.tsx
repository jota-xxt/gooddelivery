import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Download, DollarSign, TrendingUp, Truck, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    const { data: settings } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'platform_fee_percentage')
      .single();
    setFeePercent(Number(settings?.value ?? 10));

    const { data: rawReports } = await supabase
      .from('financial_weekly_reports')
      .select('*')
      .order('week_start', { ascending: false });

    if (!rawReports) { setLoading(false); return; }

    // Get unique weeks
    const uniqueWeeks = [...new Set(rawReports.map(r => r.week_start))];
    setWeeks(uniqueWeeks);

    // Get entity names
    const estIds = rawReports.filter(r => r.entity_type === 'establishment').map(r => r.entity_id);
    const driverIds = rawReports.filter(r => r.entity_type === 'driver').map(r => r.entity_id);

    const [{ data: ests }, { data: drivers }] = await Promise.all([
      supabase.from('establishments').select('id, business_name').in('id', estIds.length > 0 ? estIds : ['x']),
      supabase.from('drivers').select('id, user_id').in('id', driverIds.length > 0 ? driverIds : ['x']),
    ]);

    let driverNames: Record<string, string> = {};
    if (drivers && drivers.length > 0) {
      const userIds = drivers.map(d => d.user_id);
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
      const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) ?? []);
      for (const d of drivers) {
        driverNames[d.id] = profileMap.get(d.user_id) ?? 'Entregador';
      }
    }

    const estMap = new Map(ests?.map(e => [e.id, e.business_name]) ?? []);

    const enriched: WeeklyReport[] = rawReports.map(r => ({
      ...r,
      entity_name: r.entity_type === 'establishment'
        ? estMap.get(r.entity_id) ?? 'Desconhecido'
        : driverNames[r.entity_id] ?? 'Desconhecido',
    }));

    setReports(enriched);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    if (selectedWeek === 'all') return reports;
    return reports.filter(r => r.week_start === selectedWeek);
  }, [reports, selectedWeek]);

  const estReports = filtered.filter(r => r.entity_type === 'establishment');
  const driverReports = filtered.filter(r => r.entity_type === 'driver');

  const totals = useMemo(() => {
    const est = estReports.reduce((a, r) => ({
      deliveries: a.deliveries + r.total_deliveries,
      value: a.value + r.total_value,
      fee: a.fee + r.platform_fee,
      payout: a.payout + r.net_payout,
    }), { deliveries: 0, value: 0, fee: 0, payout: 0 });
    return est;
  }, [estReports]);

  const markAsPaid = async (id: string) => {
    const { error } = await supabase
      .from('financial_weekly_reports')
      .update({ status: 'paid' })
      .eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      setReports(prev => prev.map(r => r.id === id ? { ...r, status: 'paid' } : r));
      toast({ title: 'Marcado como pago' });
    }
  };

  const exportCSV = (data: WeeklyReport[], filename: string) => {
    const header = 'Nome,Tipo,Semana,Entregas,Valor Total,Taxa Plataforma,Repasse Líquido,Status\n';
    const rows = data.map(r =>
      `"${r.entity_name}","${r.entity_type}","${r.week_start} a ${r.week_end}",${r.total_deliveries},${r.total_value.toFixed(2)},${r.platform_fee.toFixed(2)},${r.net_payout.toFixed(2)},"${r.status}"`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatWeek = (ws: string) => {
    const d = new Date(ws + 'T00:00:00');
    return format(d, "'Semana de' dd/MM", { locale: ptBR });
  };

  const ReportTable = ({ data, type }: { data: WeeklyReport[]; type: string }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">
          {type === 'establishment' ? 'Estabelecimentos' : 'Entregadores'}
        </CardTitle>
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
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhum relatório encontrado
                </TableCell>
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
            {weeks.map(w => (
              <SelectItem key={w} value={w}>{formatWeek(w)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <Truck className="h-4 w-4" /> Total Entregas
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{totals.deliveries}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-4 w-4" /> Receita Bruta
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">R$ {totals.value.toFixed(2)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-4 w-4" /> Taxa ({feePercent}%)
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold text-primary">R$ {totals.fee.toFixed(2)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Repasse Total</CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">R$ {totals.payout.toFixed(2)}</p></CardContent>
        </Card>
      </div>

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
