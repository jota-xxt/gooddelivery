import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Star, MapPin, LocateFixed, Loader2, Package, Clock, Bell, Store, Phone, FileText, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import MapPicker from '@/components/MapPicker';
import QuickStats from '@/components/QuickStats';

const EstablishmentProfile = () => {
  const { user, signOut } = useAuth();
  const [establishment, setEstablishment] = useState<{
    id: string; business_name: string; cnpj: string; address: string; phone: string;
    latitude: number | null; longitude: number | null; created_at: string; responsible_name: string;
  } | null>(null);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [ratingCount, setRatingCount] = useState(0);
  const [totalDeliveries, setTotalDeliveries] = useState(0);
  const [notifications, setNotifications] = useState<{ id: string; title: string; message: string; created_at: string; read: boolean }[]>([]);
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
        setPickedLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setGettingLocation(false);
        toast.success('Localização obtida!');
      },
      (error) => {
        setGettingLocation(false);
        toast.error(error.code === error.PERMISSION_DENIED
          ? 'Permissão de localização negada.'
          : 'Não foi possível obter sua localização');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    if (!user) return;

    // Fetch establishment data
    supabase.from('establishments')
      .select('id, business_name, cnpj, address, phone, latitude, longitude, created_at, responsible_name')
      .eq('user_id', user.id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setEstablishment(data as any);
          // Fetch delivery count
          supabase.from('deliveries').select('id', { count: 'exact', head: true })
            .eq('establishment_id', data.id).eq('status', 'completed')
            .then(({ count }) => setTotalDeliveries(count ?? 0));
        }
      });

    // Fetch ratings
    supabase.from('ratings').select('rating').eq('to_user_id', user.id)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setAvgRating(data.reduce((s, r) => s + r.rating, 0) / data.length);
          setRatingCount(data.length);
        }
      });

    // Fetch notifications
    supabase.from('notifications').select('id, title, message, created_at, read')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(5)
      .then(({ data }) => setNotifications(data ?? []));
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
  const initials = establishment?.business_name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? '?';
  const memberSince = establishment?.created_at
    ? format(new Date(establishment.created_at), "MMM/yyyy", { locale: ptBR })
    : '-';

  return (
    <div className="pb-24">
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground px-4 pt-8 pb-12 rounded-b-3xl">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border-2 border-primary-foreground/30">
            <AvatarFallback className="bg-primary-foreground/20 text-primary-foreground text-xl font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{establishment?.business_name ?? 'Carregando...'}</h1>
            <p className="text-sm text-primary-foreground/70">{establishment?.responsible_name}</p>
            {avgRating !== null && (
              <div className="flex items-center gap-1 mt-1">
                <Star className="h-4 w-4 fill-warning text-warning" />
                <span className="font-semibold text-sm">{avgRating.toFixed(1)}</span>
                <span className="text-xs text-primary-foreground/60">({ratingCount} avaliações)</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards - Overlapping */}
      <div className="px-4 -mt-6">
        <QuickStats stats={[
          { label: 'Entregas', value: totalDeliveries, icon: Package, color: 'bg-primary/10 text-primary' },
          { label: 'Avaliação', value: avgRating?.toFixed(1) ?? '-', icon: Star, color: 'bg-warning/10 text-warning' },
          { label: 'Membro', value: memberSince, icon: Clock, color: 'bg-success/10 text-success' },
        ]} />
      </div>

      <div className="p-4 space-y-4">
        {/* Info Card */}
        <Card>
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center gap-3">
              <Store className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">CNPJ</p>
                <p className="text-sm font-medium">{establishment?.cnpj}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Endereço</p>
                <p className="text-sm font-medium">{establishment?.address}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Telefone</p>
                <p className="text-sm font-medium">{establishment?.phone}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location Card */}
        <Card>
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">Localização no Mapa</p>
                  <p className="text-xs text-muted-foreground">
                    {hasLocation ? 'Localização definida ✓' : 'Não definida'}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => {
                if (hasLocation) setPickedLocation({ lat: establishment!.latitude!, lng: establishment!.longitude! });
                setMapOpen(true);
              }}>
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

        {/* Notifications */}
        {notifications.length > 0 && (
          <Card>
            <CardContent className="py-4 space-y-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">Notificações Recentes</p>
              </div>
              <div className="space-y-2">
                {notifications.map(n => (
                  <div key={n.id} className={`p-3 rounded-lg border ${n.read ? 'bg-muted/50' : 'bg-accent/50 border-primary/20'}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{n.title}</p>
                      {!n.read && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {format(new Date(n.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Button variant="outline" className="w-full" onClick={signOut}>
          <LogOut className="h-4 w-4 mr-2" />
          Sair
        </Button>
      </div>

      {/* Map picker modal */}
      <Dialog open={mapOpen} onOpenChange={setMapOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Definir Localização do Estabelecimento</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground flex-1">Busque seu endereço, clique no mapa ou use sua localização atual.</p>
            <Button variant="outline" size="sm" onClick={handleGetCurrentLocation} disabled={gettingLocation}>
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
