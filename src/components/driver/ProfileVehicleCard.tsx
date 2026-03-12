import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bike, Car, Truck } from 'lucide-react';

interface ProfileVehicleCardProps {
  vehicleType: string;
  plate: string | null;
}

const vehicleConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  motorcycle: { icon: <Bike className="h-8 w-8" />, label: 'Moto', color: 'text-primary' },
  bicycle: { icon: <Bike className="h-8 w-8" />, label: 'Bicicleta', color: 'text-green-600' },
  car: { icon: <Car className="h-8 w-8" />, label: 'Carro', color: 'text-blue-600' },
};

const ProfileVehicleCard = ({ vehicleType, plate }: ProfileVehicleCardProps) => {
  const config = vehicleConfig[vehicleType] ?? { icon: <Truck className="h-8 w-8" />, label: vehicleType, color: 'text-muted-foreground' };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Veículo</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-xl bg-muted flex items-center justify-center ${config.color}`}>
            {config.icon}
          </div>
          <div className="flex-1">
            <p className="font-semibold">{config.label}</p>
            {plate && (
              <div className="mt-1 inline-block rounded border-2 border-foreground/20 bg-card px-3 py-0.5">
                <span className="font-mono text-sm font-bold tracking-widest">{plate}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfileVehicleCard;
