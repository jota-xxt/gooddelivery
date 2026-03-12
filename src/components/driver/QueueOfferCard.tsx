import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, DollarSign, Loader2, Store, Truck, X, Timer } from 'lucide-react';

interface OfferDelivery {
  delivery_address: string;
  delivery_fee: number;
  observations: string | null;
  establishment_name?: string;
  establishment_address?: string;
}

interface QueueOfferCardProps {
  deliveryId: string;
  delivery: OfferDelivery;
  offerTimer: number;
  actionLoading: boolean;
  rejectingOffer: boolean;
  onAccept: (deliveryId: string) => void;
  onReject: () => void;
}

const QueueOfferCard = ({ deliveryId, delivery, offerTimer, actionLoading, rejectingOffer, onAccept, onReject }: QueueOfferCardProps) => {
  return (
    <Card className="border-2 border-primary overflow-hidden animate-in fade-in">
      <div className="bg-primary px-4 py-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-primary-foreground">Nova Corrida Para Você!</p>
        <div className="flex items-center gap-1.5">
          <Timer className="h-4 w-4 text-primary-foreground" />
          <span className={`text-lg font-bold text-primary-foreground ${offerTimer <= 10 ? 'animate-pulse' : ''}`}>
            {offerTimer}s
          </span>
        </div>
      </div>
      <CardContent className="py-4 space-y-4">
        {/* Timer progress bar */}
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${offerTimer <= 10 ? 'bg-destructive' : 'bg-primary'}`}
            style={{ width: `${(offerTimer / 60) * 100}%` }}
          />
        </div>

        {/* Value */}
        <div className="text-center">
          <span className="text-3xl font-bold text-primary flex items-center justify-center gap-1">
            <DollarSign className="h-6 w-6" />
            R$ {Number(delivery.delivery_fee).toFixed(2)}
          </span>
        </div>

        {/* Route */}
        <div className="relative pl-6 space-y-3">
          <div className="absolute left-[11px] top-2 bottom-2 w-0.5 border-l-2 border-dashed border-muted-foreground/30" />
          <div className="relative flex items-start gap-2">
            <div className="absolute -left-6 top-0.5 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
              <Store className="h-3 w-3 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">{delivery.establishment_name}</p>
              <p className="text-xs text-muted-foreground truncate max-w-[240px]">{delivery.establishment_address}</p>
            </div>
          </div>
          <div className="relative flex items-start gap-2">
            <div className="absolute -left-6 top-0.5 h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
              <MapPin className="h-3 w-3 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium truncate max-w-[240px]">{delivery.delivery_address}</p>
              {delivery.observations && <p className="text-xs text-muted-foreground">{delivery.observations}</p>}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            className="flex-1 h-12 font-bold text-base"
            onClick={() => onAccept(deliveryId)}
            disabled={actionLoading}
          >
            {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            <Truck className="h-4 w-4 mr-2" />
            Aceitar
          </Button>
          <Button
            variant="destructive"
            className="h-12 px-6 font-bold"
            onClick={onReject}
            disabled={rejectingOffer}
          >
            {rejectingOffer ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-5 w-5" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default QueueOfferCard;
