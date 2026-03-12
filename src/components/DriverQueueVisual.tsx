import { Users, User, Clock, TrendingUp, Crown } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

export interface QueueDriver {
  id: string;
  name: string;
  position: number;
  isMe: boolean;
}

interface DriverQueueVisualProps {
  position: number | null;
  totalDrivers: number;
  searchingCount: number;
  queueDrivers: QueueDriver[];
}

const DriverQueueVisual = ({ position, totalDrivers, searchingCount, queueDrivers }: DriverQueueVisualProps) => {
  if (position === null) return null;

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

      {/* Driver list */}
      {queueDrivers.length > 0 && (
        <div className="px-4 pb-4">
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Ordem na fila</p>
          <ScrollArea className="max-h-[240px]">
            <div className="space-y-1.5">
              {queueDrivers.map((driver) => {
                const initials = driver.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                const firstName = driver.name.split(' ')[0];
                return (
                  <div
                    key={driver.id}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${
                      driver.isMe
                        ? 'bg-primary/10 border border-primary/30 ring-1 ring-primary/20'
                        : 'bg-muted/40'
                    }`}
                  >
                    {/* Position number */}
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      driver.position === 1
                        ? 'bg-amber-500 text-white'
                        : driver.isMe
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted-foreground/20 text-muted-foreground'
                    }`}>
                      {driver.position === 1 ? <Crown className="h-3.5 w-3.5" /> : driver.position}
                    </div>

                    {/* Avatar */}
                    <Avatar className={`h-8 w-8 shrink-0 ${driver.isMe ? 'ring-2 ring-primary' : ''}`}>
                      <AvatarFallback className={`text-[10px] font-bold ${
                        driver.isMe ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}>
                        {initials || '?'}
                      </AvatarFallback>
                    </Avatar>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${driver.isMe ? 'text-primary' : 'text-foreground'}`}>
                        {driver.isMe ? `${firstName} (Você)` : firstName}
                      </p>
                    </div>

                    {/* Status indicator */}
                    <div className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                  </div>
                );
              })}
            </div>
            <ScrollBar orientation="vertical" />
          </ScrollArea>
        </div>
      )}

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
