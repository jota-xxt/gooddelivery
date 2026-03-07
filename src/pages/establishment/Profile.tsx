import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Star, MapPin, LocateFixed, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import MapPicker from '@/components/MapPicker';

const EstablishmentProfile = () => {
  const { user, signOut } = useAuth();
  const [establishment, setEstablishment] = useState<{
    id: string; business_name: string; cnpj: string; address: string; phone: string;
    latitude: number | null; longitude: number | null;
  } | null>(null);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [pickedLocation, setPickedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  const handleGetCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Seu navegador não suporta geolocalização');
      return;
    }
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setPickedLocation({ lat: latitude, lng: longitude });
        setGettingLocation(false);
        toast.success('Localização obtida!');
      },
      (error) => {
        setGettingLocation(false);
        if (error.code === error.PERMISSION_DENIED) {
          toast.error('Permissão de localização negada. Habilite nas configurações do navegador.');
        } else {
          toast.error('Não foi possível obter sua localização');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from('establishments').select('id, business_name, cnpj, address, phone, latitude, longitude').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => {
        if (data) setEstablishment(data as any);
      });
    supabase.from('ratings').select('rating').eq('to_user_id', user.id)
      .then(({ data }) => {
        if (data && data.length > 0) setAvgRating(data.reduce((s, r) => s + r.rating, 0) / data.length);
      });
  }, [user]);

  const handleSaveLocation = async () => {
    if (!pickedLocation || !establishment) return;
    setSaving(true);
    const { error } = await supabase
      .from('establishments')
      .update({ latitude: pickedLocation.lat, longitude: pickedLocation.lng } as any)
      .eq('id', establishment.id);
    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar localização');
    } else {
      setEstablishment({ ...establishment, latitude: pickedLocation.lat, longitude: pickedLocation.lng });
      setMapOpen(false);
      toast.success('Localização salva com sucesso!');
    }
  };

  const hasLocation = establishment?.latitude && establishment?.longitude;

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

      {/* Location on map */}
      <Card>
        <CardContent className="py-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Localização no Mapa</p>
              <p className="text-sm font-medium">
                {hasLocation ? 'Localização definida ✓' : 'Não definida'}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => {
              if (hasLocation) setPickedLocation({ lat: establishment!.latitude!, lng: establishment!.longitude! });
              setMapOpen(true);
            }}>
              <MapPin className="h-4 w-4 mr-1" />
              {hasLocation ? 'Alterar' : 'Definir'}
            </Button>
          </div>
          {hasLocation && (
            <MapPicker
              mode="view"
              markers={[{ lat: establishment!.latitude!, lng: establishment!.longitude!, label: establishment!.business_name, color: 'hsl(358, 82%, 53%)' }]}
              center={[establishment!.latitude!, establishment!.longitude!]}
              zoom={16}
              height="180px"
            />
          )}
        </CardContent>
      </Card>

      <Button variant="outline" className="w-full" onClick={signOut}>Sair</Button>

      {/* Map picker modal */}
      <Dialog open={mapOpen} onOpenChange={setMapOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Definir Localização do Estabelecimento</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground flex-1">Busque seu endereço, clique no mapa ou use sua localização atual.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGetCurrentLocation}
              disabled={gettingLocation}
            >
              {gettingLocation ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <LocateFixed className="h-4 w-4 mr-1" />}
              {gettingLocation ? 'Obtendo...' : 'Usar minha localização'}
            </Button>
          </div>
          <MapPicker
            mode="pick"
            searchEnabled
            onLocationSelect={(lat, lng) => setPickedLocation({ lat, lng })}
            center={hasLocation ? [establishment!.latitude!, establishment!.longitude!] : [-14.235, -51.925]}
            zoom={hasLocation ? 16 : 4}
            height="350px"
            markers={pickedLocation ? [{ lat: pickedLocation.lat, lng: pickedLocation.lng, color: 'hsl(358, 82%, 53%)' }] : []}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMapOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveLocation} disabled={!pickedLocation || saving}>
              {saving ? 'Salvando...' : 'Confirmar Localização'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EstablishmentProfile;
