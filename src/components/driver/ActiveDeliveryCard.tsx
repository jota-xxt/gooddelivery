import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import MapPicker, { type MapMarker } from '@/components/MapPicker';
import { MapPin, Clock, Loader2, Store, Package, CheckCircle2, Navigation, MessageSquare } from 'lucide-react';

interface DeliveryWithEstablishment {
  id: string;
  delivery_address: string;
  delivery_fee: number;
  status: string;
  establishment_id: string;
  created_at: string;
  accepted_at: string | null;
  observations: string | null;
  urgency: string;
  establishment_name?: string;
  establishment_address?: string;
  establishment_lat?: number | null;
  establishment_lng?: number | null;
}

interface ActiveDeliveryCardProps {
  delivery: DeliveryWithEstablishment;
  mapMarkers: MapMarker[];
  actionLoading: boolean;
  onAdvance: () => void;
  onOpenChat: () => void;
  onOpenMaps: (address: string) => void;
}

const stepperSteps = [
  { key: 'accepted', icon: Store, label: 'Aceito' },
  { key: 'collecting', icon: Package, label: 'Coletando' },
  { key: 'delivering', icon: MapPin, label: 'Entregando' },
];

const statusActions: Record<string, string> = {
  accepted: 'Cheguei no estabelecimento',
  collecting: 'Saí para entrega',
  delivering: 'Entrega concluída',
};

const timeSince = (dateStr: string) => {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 1) return 'agora';
  if (diff < 60) return `${diff}min`;
  return `${Math.floor(diff / 60)}h`;
};

const ActiveDeliveryCard = ({ delivery, mapMarkers, actionLoading, onAdvance, onOpenChat, onOpenMaps }: ActiveDeliveryCardProps) => {
  return (
    <Card className="border-2 border-primary overflow-hidden">
      <div className="bg-primary px-4 py-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-primary-foreground">Entrega Ativa</p>
          {delivery.accepted_at && (
            <Badge variant="secondary" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              {timeSince(delivery.accepted_at)}
            </Badge>
          )}
        </div>
      </div>
      <CardContent className="py-4 space-y-4">
        {/* Visual stepper */}
        <div className="flex items-center justify-between px-2">
          {stepperSteps.map((step, i) => {
            const currentIdx = stepperSteps.findIndex(s => s.key === delivery.status);
            const done = i < currentIdx;
            const active = i === currentIdx;
            const Icon = step.icon;
            return (
              <div key={step.key} className="flex items-center">
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    done ? 'bg-green-500 text-white' : active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}>
                    {done ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <span className={`text-[10px] font-medium ${active ? 'text-primary' : 'text-muted-foreground'}`}>
                    {step.label}
                  </span>
                </div>
                {i < stepperSteps.length - 1 && (
                  <div className={`w-8 h-0.5 mx-1 mb-4 ${done ? 'bg-green-500' : 'bg-muted'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Value */}
        <div className="text-center">
          <span className="text-2xl font-bold text-primary">R$ {Number(delivery.delivery_fee).toFixed(2)}</span>
        </div>

        {/* Delivery map */}
        {mapMarkers.length > 0 && (
          <MapPicker mode="view" markers={mapMarkers} height="180px" />
        )}

        {/* Route visualization */}
        <div className="relative pl-6 space-y-3">
          <div className="absolute left-[11px] top-2 bottom-2 w-0.5 border-l-2 border-dashed border-muted-foreground/30" />
          <div className="relative flex items-start gap-3">
            <div className="absolute -left-6 top-0.5 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
              <Store className="h-3 w-3 text-primary-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Coleta</p>
              <p className="text-sm font-medium">{delivery.establishment_name}</p>
              <p className="text-xs text-muted-foreground">{delivery.establishment_address}</p>
            </div>
          </div>
          <div className="relative flex items-start gap-3">
            <div className="absolute -left-6 top-0.5 h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
              <MapPin className="h-3 w-3 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Entrega</p>
              <p className="text-sm font-medium truncate max-w-[240px]">{delivery.delivery_address}</p>
              {delivery.observations && <p className="text-xs text-muted-foreground">{delivery.observations}</p>}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            className="flex-1 h-12 font-bold text-base"
            onClick={onAdvance}
            disabled={actionLoading}
          >
            {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {statusActions[delivery.status]}
          </Button>
          <Button variant="outline" size="icon" className="h-12 w-12" onClick={onOpenChat}>
            <MessageSquare className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12"
            onClick={() => onOpenMaps(
              delivery.status === 'accepted' || delivery.status === 'collecting'
                ? delivery.establishment_address ?? ''
                : delivery.delivery_address
            )}
          >
            <Navigation className="h-5 w-5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ActiveDeliveryCard;
