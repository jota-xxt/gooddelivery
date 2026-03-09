import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users, User, Crown } from 'lucide-react';

const EstablishmentQueueInfo = () => {
  const [totalOnline, setTotalOnline] = useState(0);
  const [nextDriver, setNextDriver] = useState<{ name: string; vehicle: string } | null>(null);

  const fetchQueue = useCallback(async () => {
    const { data: drivers } = await supabase
      .from('drivers')
      .select('id, user_id, vehicle_type')
      .eq('is_online', true)
      .not('queue_joined_at', 'is', null)
      .order('queue_joined_at', { ascending: true });

    if (!drivers || drivers.length === 0) {
      setTotalOnline(0);
      setNextDriver(null);
      return;
    }

    setTotalOnline(drivers.length);

    // Get next driver's name
    const first = drivers[0];
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', first.user_id)
      .maybeSingle();

    setNextDriver({
      name: profile?.full_name ?? 'Entregador',
      vehicle: first.vehicle_type === 'motorcycle' ? 'Moto' : first.vehicle_type === 'bicycle' ? 'Bicicleta' : 'Carro',
    });
  }, []);

  useEffect(() => {
    fetchQueue();

    const channel = supabase
      .channel('est-queue-info')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, fetchQueue)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchQueue]);

  return (
    <Card>
      <CardContent className="py-3 flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{totalOnline} entregador{totalOnline !== 1 ? 'es' : ''} na fila</span>
            {totalOnline > 0 && (
              <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
            )}
          </div>
          {nextDriver ? (
            <div className="flex items-center gap-1.5 mt-0.5">
              <Crown className="h-3 w-3 text-warning" />
              <span className="text-xs text-muted-foreground truncate">
                Próximo: <strong className="text-foreground">{nextDriver.name}</strong> · {nextDriver.vehicle}
              </span>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">Nenhum entregador disponível no momento</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default EstablishmentQueueInfo;
