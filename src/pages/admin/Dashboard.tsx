import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Package, Users, DollarSign, Truck } from 'lucide-react';

const AdminDashboard = () => {
  const [metrics, setMetrics] = useState({
    totalDeliveries: 0,
    activeDrivers: 0,
    activeEstablishments: 0,
    revenue: 0,
  });

  useEffect(() => {
    const fetchMetrics = async () => {
      const [deliveries, drivers, establishments] = await Promise.all([
        supabase.from('deliveries').select('id, delivery_fee, status', { count: 'exact' }),
        supabase.from('drivers').select('id', { count: 'exact' }).eq('is_online', true),
        supabase.from('establishments').select('id', { count: 'exact' }),
      ]);

      const completedDeliveries = deliveries.data?.filter(d => d.status === 'completed') ?? [];
      const revenue = completedDeliveries.reduce((sum, d) => sum + Number(d.delivery_fee), 0);

      setMetrics({
        totalDeliveries: deliveries.count ?? 0,
        activeDrivers: drivers.count ?? 0,
        activeEstablishments: establishments.count ?? 0,
        revenue,
      });
    };
    fetchMetrics();
  }, []);

  const cards = [
    { title: 'Total Entregas', value: metrics.totalDeliveries, icon: Package, color: 'text-primary' },
    { title: 'Entregadores Online', value: metrics.activeDrivers, icon: Truck, color: 'text-success' },
    { title: 'Estabelecimentos', value: metrics.activeEstablishments, icon: Users, color: 'text-warning' },
    { title: 'Faturamento', value: `R$ ${metrics.revenue.toFixed(2)}`, icon: DollarSign, color: 'text-primary' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboard;
