import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign } from 'lucide-react';

const DriverEarnings = () => {
  const { user } = useAuth();
  const [earnings, setEarnings] = useState({ today: 0, week: 0, month: 0, deliveries: 0 });
  const [feePercent, setFeePercent] = useState(10);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data: driver } = await supabase.from('drivers').select('id').eq('user_id', user.id).single();
      if (!driver) return;

      const { data: settings } = await supabase.from('app_settings').select('value').eq('key', 'platform_fee_percentage').single();
      const fee = Number(settings?.value ?? 10);
      setFeePercent(fee);

      const { data: deliveries } = await supabase
        .from('deliveries')
        .select('delivery_fee, delivered_at')
        .eq('driver_id', driver.id)
        .eq('status', 'completed');

      if (!deliveries) return;

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      let today = 0, week = 0, month = 0;
      for (const d of deliveries) {
        const net = Number(d.delivery_fee) * (1 - fee / 100);
        const date = new Date(d.delivered_at ?? '');
        if (date >= todayStart) today += net;
        if (date >= weekStart) week += net;
        if (date >= monthStart) month += net;
      }

      setEarnings({ today, week, month, deliveries: deliveries.length });
    };
    fetch();
  }, [user]);

  return (
    <div className="p-4 space-y-6">
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
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Entregas</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold flex items-center gap-1"><DollarSign className="h-4 w-4 text-primary" />{earnings.deliveries}</p></CardContent>
        </Card>
      </div>
      <p className="text-xs text-muted-foreground text-center">Taxa da plataforma: {feePercent}%</p>
    </div>
  );
};

export default DriverEarnings;
