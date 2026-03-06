import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Delivery {
  id: string;
  customer_name: string;
  delivery_address: string;
  delivery_fee: number;
  status: string;
  created_at: string;
}

const EstablishmentHistory = () => {
  const { user } = useAuth();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data: est } = await supabase.from('establishments').select('id').eq('user_id', user.id).single();
      if (!est) return;
      const { data } = await supabase
        .from('deliveries')
        .select('id, customer_name, delivery_address, delivery_fee, status, created_at')
        .eq('establishment_id', est.id)
        .in('status', ['completed', 'cancelled'])
        .order('created_at', { ascending: false });
      setDeliveries(data ?? []);
    };
    fetch();
  }, [user]);

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Histórico</h1>
      {deliveries.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma entrega no histórico</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {deliveries.map((d) => (
            <Card key={d.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold">{d.customer_name}</p>
                  <Badge variant={d.status === 'completed' ? 'default' : 'destructive'}>
                    {d.status === 'completed' ? 'Concluída' : 'Cancelada'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{d.delivery_address}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm font-medium">R$ {Number(d.delivery_fee).toFixed(2)}</span>
                  <span className="text-xs text-muted-foreground">{format(new Date(d.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default EstablishmentHistory;
