import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface FinancialRow {
  establishment_name: string;
  total_deliveries: number;
  total_value: number;
  platform_fee: number;
  driver_payout: number;
}

const AdminFinancial = () => {
  const [data, setData] = useState<FinancialRow[]>([]);
  const [feePercent, setFeePercent] = useState(10);

  useEffect(() => {
    const fetch = async () => {
      const { data: settings } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'platform_fee_percentage')
        .single();
      const fee = Number(settings?.value ?? 10);
      setFeePercent(fee);

      const { data: deliveries } = await supabase
        .from('deliveries')
        .select('establishment_id, delivery_fee, status')
        .eq('status', 'completed');

      if (!deliveries) return;

      const { data: establishments } = await supabase.from('establishments').select('id, business_name');
      const estMap = new Map(establishments?.map((e) => [e.id, e.business_name]) ?? []);

      const grouped: Record<string, { total: number; count: number; name: string }> = {};
      for (const d of deliveries) {
        const key = d.establishment_id;
        if (!grouped[key]) grouped[key] = { total: 0, count: 0, name: estMap.get(key) ?? 'Desconhecido' };
        grouped[key].total += Number(d.delivery_fee);
        grouped[key].count += 1;
      }

      setData(
        Object.values(grouped).map((g) => ({
          establishment_name: g.name,
          total_deliveries: g.count,
          total_value: g.total,
          platform_fee: g.total * (fee / 100),
          driver_payout: g.total * (1 - fee / 100),
        }))
      );
    };
    fetch();
  }, []);

  const totals = data.reduce(
    (acc, r) => ({
      deliveries: acc.deliveries + r.total_deliveries,
      value: acc.value + r.total_value,
      fee: acc.fee + r.platform_fee,
      payout: acc.payout + r.driver_payout,
    }),
    { deliveries: 0, value: 0, fee: 0, payout: 0 }
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Relatório Financeiro</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Entregas</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{totals.deliveries}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Taxa Plataforma ({feePercent}%)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-primary">R$ {totals.fee.toFixed(2)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Repasse Entregadores</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">R$ {totals.payout.toFixed(2)}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estabelecimento</TableHead>
                <TableHead className="text-right">Entregas</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead className="text-right">Taxa</TableHead>
                <TableHead className="text-right">Repasse</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.establishment_name}>
                  <TableCell className="font-medium">{row.establishment_name}</TableCell>
                  <TableCell className="text-right">{row.total_deliveries}</TableCell>
                  <TableCell className="text-right">R$ {row.total_value.toFixed(2)}</TableCell>
                  <TableCell className="text-right">R$ {row.platform_fee.toFixed(2)}</TableCell>
                  <TableCell className="text-right">R$ {row.driver_payout.toFixed(2)}</TableCell>
                </TableRow>
              ))}
              {data.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma entrega concluída</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminFinancial;
