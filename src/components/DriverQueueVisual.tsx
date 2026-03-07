import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Users, User, Clock, TrendingUp } from 'lucide-react';

interface DriverQueueVisualProps {
  driverId: string;
  isOnline: boolean;
}

const DriverQueueVisual = ({ driverId, isOnline }: DriverQueueVisualProps) => {
  const [position, setPosition] = useState<number | null>(null);
  const [totalDrivers, setTotalDrivers] = useState(0);
  const [searchingCount, setSearchingCount] = useState(0);

  const fetchQueueData = useCallback(async () => {
    if (!driverId || !isOnline) {
      setPosition(null);
      setTotalDrivers(0);
      return;
    }

    const [driversRes, searchingRes] = await Promise.all([
      supabase
        .from('drivers')
        .select('id')
        .eq('is_online', true)
        .not('queue_joined_at', 'is', null)
        .order('queue_joined_at', { ascending: true }),
      supabase
        .from('deliveries')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'searching'),
    ]);

    if (driversRes.data) {
      const pos = driversRes.data.findIndex(d => d.id === driverId);
      setPosition(pos >= 0 ? pos + 1 : null);
      setTotalDrivers(driversRes.data.length);
    }
    setSearchingCount(searchingRes.count ?? 0);
  }, [driverId, isOnline]);

  useEffect(() => {
    fetchQueueData();

    const channels = [
      supabase
        .channel('queue-visual-drivers')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, () => fetchQueueData())
        .subscribe(),
      supabase
        .channel('queue-visual-deliveries')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, () => fetchQueueData())
        .subscribe(),
    ];

    return () => { channels.forEach(c => supabase.removeChannel(c)); };
  }, [fetchQueueData]);

  if (position === null) return null;

  // Generate visual queue dots - show max 9 dots to keep it compact
  const maxDots = Math.min(totalDrivers, 9);
  const showEllipsis = totalDrivers > 9;
  const myDotIndex = position - 1;

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-4 py-3 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <span className="font-semibold text-sm">Fila de Entregadores</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span>{totalDrivers} online</span>
          </div>
        </div>
      </div>

      {/* Position highlight */}
      <div className="px-4 py-5 flex flex-col items-center">
        <div className="relative mb-4">
          <div className="h-20 w-20 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/25">
            <span className="text-3xl font-black text-primary-foreground">{position}º</span>
          </div>
          <div className="absolute -inset-1 rounded-full border-2 border-primary/30 animate-[spin_8s_linear_infinite]" 
            style={{ borderStyle: 'dashed' }} />
        </div>
        <p className="text-sm font-medium text-foreground">Sua posição na fila</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {position === 1 ? 'Você é o próximo!' : `${position - 1} entregador${position - 1 > 1 ? 'es' : ''} na sua frente`}
        </p>
      </div>

      {/* Visual queue strip */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-center gap-1.5">
          {Array.from({ length: maxDots }).map((_, i) => {
            const isMe = i === Math.min(myDotIndex, maxDots - 1);
            const isAhead = i < Math.min(myDotIndex, maxDots - 1);
            const isBehind = i > Math.min(myDotIndex, maxDots - 1);

            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <div
                  className={`
                    rounded-full transition-all duration-500 flex items-center justify-center
                    ${isMe
                      ? 'h-9 w-9 bg-primary ring-2 ring-primary/30 ring-offset-2 ring-offset-background shadow-md'
                      : isAhead
                        ? 'h-7 w-7 bg-muted-foreground/60'
                        : 'h-7 w-7 bg-muted-foreground/20'
                    }
                  `}
                >
                  {isMe ? (
                    <User className="h-4 w-4 text-primary-foreground" />
                  ) : (
                    <User className={`h-3 w-3 ${isAhead ? 'text-background/80' : 'text-muted-foreground/50'}`} />
                  )}
                </div>
                {isMe && (
                  <span className="text-[9px] font-bold text-primary">Você</span>
                )}
              </div>
            );
          })}
          {showEllipsis && (
            <span className="text-xs text-muted-foreground font-bold ml-1">+{totalDrivers - 9}</span>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="border-t bg-muted/30 px-4 py-2.5 flex items-center justify-around">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <TrendingUp className="h-3.5 w-3.5" />
          <span><strong className="text-foreground">{searchingCount}</strong> pedido{searchingCount !== 1 ? 's' : ''} aguardando</span>
        </div>
        <div className="h-3 w-px bg-border" />
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>Aguardando vez</span>
        </div>
      </div>
    </div>
  );
};

export default DriverQueueVisual;
