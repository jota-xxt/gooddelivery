import { CheckCircle2, Search, Truck, Package, MapPin } from 'lucide-react';

const steps = [
  { key: 'searching', label: 'Buscando', icon: Search },
  { key: 'accepted', label: 'Aceito', icon: CheckCircle2 },
  { key: 'collecting', label: 'Coletando', icon: Package },
  { key: 'delivering', label: 'Entregando', icon: Truck },
];

interface DeliveryTrackerProps {
  status: string;
}

const DeliveryTracker = ({ status }: DeliveryTrackerProps) => {
  const currentIdx = steps.findIndex(s => s.key === status);

  return (
    <div className="flex items-center gap-1 w-full">
      {steps.map((step, i) => {
        const Icon = step.icon;
        const isActive = i <= currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <div key={step.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                  isCurrent
                    ? 'bg-primary text-primary-foreground scale-110 shadow-md shadow-primary/30'
                    : isActive
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              <span className={`text-[10px] mt-1 ${isCurrent ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 flex-1 mx-0.5 rounded-full ${i < currentIdx ? 'bg-primary' : 'bg-muted'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default DeliveryTracker;
