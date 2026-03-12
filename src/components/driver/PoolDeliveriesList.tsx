import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, DollarSign, Loader2, Store, Truck, Radio } from 'lucide-react';

interface PoolDelivery {
  id: string;
  delivery_address: string;
  delivery_fee: number;
  created_at: string;
  observations: string | null;
  establishment_name?: string;
  establishment_address?: string;
}

interface PoolDeliveriesListProps {
  deliveries: PoolDelivery[];
  actionLoading: boolean;
  onAccept: (deliveryId: string) => void;
}

const timeSince = (dateStr: string) => {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 1) return 'agora';
  if (diff < 60) return `${diff}min`;
  return `${Math.floor(diff / 60)}h`;
};

const PoolDeliveriesList = ({ deliveries, actionLoading, onAccept }: PoolDeliveriesListProps) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-lg">Corridas Disponíveis</h2>
        <Badge variant="secondary">{deliveries.length}</Badge>
      </div>
      {deliveries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="relative mb-4">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Radio className="h-10 w-10 text-primary" />
            </div>
            <div className="absolute inset-0 h-20 w-20 rounded-full bg-primary/10 animate-ping" />
          </div>
          <p className="font-semibold text-lg">Buscando corridas...</p>
          <p className="text-sm text-muted-foreground mt-1">Novas corridas aparecerão automaticamente</p>
        </div>
      ) : (
        deliveries.map((d) => (
          <Card key={d.id} className="overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-4 py-3 bg-muted/50">
                <span className="text-xl font-bold text-primary flex items-center gap-1">
                  <DollarSign className="h-5 w-5" />
                  R$ {Number(d.delivery_fee).toFixed(2)}
                </span>
                <span className="text-xs text-muted-foreground">{timeSince(d.created_at)}</span>
              </div>
              <div className="px-4 py-3">
                <div className="relative pl-6 space-y-3">
                  <div className="absolute left-[11px] top-2 bottom-2 w-0.5 border-l-2 border-dashed border-muted-foreground/30" />
                  <div className="relative flex items-start gap-2">
                    <div className="absolute -left-6 top-0.5 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                      <Store className="h-3 w-3 text-primary-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{d.establishment_name}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[240px]">{d.establishment_address}</p>
                    </div>
                  </div>
                  <div className="relative flex items-start gap-2">
                    <div className="absolute -left-6 top-0.5 h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
                      <MapPin className="h-3 w-3 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium truncate max-w-[240px]">{d.delivery_address}</p>
                      {d.observations && <p className="text-xs text-muted-foreground">{d.observations}</p>}
                    </div>
                  </div>
                </div>
              </div>
              <div className="px-4 pb-3">
                <Button
                  className="w-full h-11 font-bold"
                  onClick={() => onAccept(d.id)}
                  disabled={actionLoading}
                >
                  {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  <Truck className="h-4 w-4 mr-2" />
                  Aceitar Corrida
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};

export default PoolDeliveriesList;
