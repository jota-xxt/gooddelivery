import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star } from 'lucide-react';

const DriverProfile = () => {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<{ full_name: string; phone: string } | null>(null);
  const [driver, setDriver] = useState<{ vehicle_type: string; cpf: string } | null>(null);
  const [avgRating, setAvgRating] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('full_name, phone').eq('user_id', user.id).single()
      .then(({ data }) => setProfile(data));
    supabase.from('drivers').select('vehicle_type, cpf').eq('user_id', user.id).single()
      .then(({ data }) => setDriver(data));
    supabase.from('ratings').select('rating').eq('to_user_id', user.id)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setAvgRating(data.reduce((s, r) => s + r.rating, 0) / data.length);
        }
      });
  }, [user]);

  const vehicleLabels: Record<string, string> = { motorcycle: 'Moto', bicycle: 'Bicicleta' };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Meu Perfil</h1>
      <Card>
        <CardContent className="py-4 space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">Nome</p>
            <p className="font-semibold">{profile?.full_name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Telefone</p>
            <p className="font-semibold">{profile?.phone}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Veículo</p>
            <p className="font-semibold">{vehicleLabels[driver?.vehicle_type ?? ''] ?? '-'}</p>
          </div>
          {avgRating !== null && (
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-warning fill-warning" />
              <span className="font-bold">{avgRating.toFixed(1)}</span>
              <span className="text-sm text-muted-foreground">média</span>
            </div>
          )}
        </CardContent>
      </Card>
      <Button variant="outline" className="w-full" onClick={signOut}>Sair</Button>
    </div>
  );
};

export default DriverProfile;
