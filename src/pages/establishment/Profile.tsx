import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star } from 'lucide-react';

const EstablishmentProfile = () => {
  const { user, signOut } = useAuth();
  const [establishment, setEstablishment] = useState<{ business_name: string; cnpj: string; address: string; phone: string } | null>(null);
  const [avgRating, setAvgRating] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from('establishments').select('business_name, cnpj, address, phone').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => setEstablishment(data));
    supabase.from('ratings').select('rating').eq('to_user_id', user.id)
      .then(({ data }) => {
        if (data && data.length > 0) setAvgRating(data.reduce((s, r) => s + r.rating, 0) / data.length);
      });
  }, [user]);

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Perfil</h1>
      <Card>
        <CardContent className="py-4 space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">Negócio</p>
            <p className="font-semibold">{establishment?.business_name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">CNPJ</p>
            <p className="font-semibold">{establishment?.cnpj}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Endereço</p>
            <p className="font-semibold">{establishment?.address}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Telefone</p>
            <p className="font-semibold">{establishment?.phone}</p>
          </div>
          {avgRating !== null && (
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-warning fill-warning" />
              <span className="font-bold">{avgRating.toFixed(1)}</span>
            </div>
          )}
        </CardContent>
      </Card>
      <Button variant="outline" className="w-full" onClick={signOut}>Sair</Button>
    </div>
  );
};

export default EstablishmentProfile;
