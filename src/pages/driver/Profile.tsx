import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AvatarUpload from '@/components/AvatarUpload';
import { Skeleton } from '@/components/ui/skeleton';
import { Star, Phone, CreditCard, Bike, Car, Truck, Calendar, Package, Bell, LogOut, QrCode, Save } from 'lucide-react';
import { PushNotificationToggle } from '@/components/PushNotificationToggle';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const DriverProfile = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<{ full_name: string; phone: string; created_at: string; avatar_url: string | null } | null>(null);
  const [driver, setDriver] = useState<{ id: string; vehicle_type: string; cpf: string; plate: string | null; pix_key: string | null } | null>(null);
  const [pixKey, setPixKey] = useState('');
  const [savingPix, setSavingPix] = useState(false);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [ratingCount, setRatingCount] = useState(0);
  const [totalDeliveries, setTotalDeliveries] = useState(0);
  const [notifications, setNotifications] = useState<{ id: string; title: string; message: string; created_at: string; read: boolean }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    const [profileRes, driverRes, ratingsRes, notifsRes] = await Promise.all([
      supabase.from('profiles').select('full_name, phone, created_at, avatar_url').eq('user_id', user!.id).maybeSingle(),
      supabase.from('drivers').select('id, vehicle_type, cpf, plate, pix_key').eq('user_id', user!.id).maybeSingle(),
      supabase.from('ratings').select('rating').eq('to_user_id', user!.id),
      supabase.from('notifications').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(5),
    ]);

    setProfile(profileRes.data);
    if (driverRes.data) {
      setDriver(driverRes.data as any);
      setPixKey(driverRes.data.pix_key ?? '');
    }
    setNotifications(notifsRes.data ?? []);

    if (ratingsRes.data && ratingsRes.data.length > 0) {
      setAvgRating(ratingsRes.data.reduce((s, r) => s + r.rating, 0) / ratingsRes.data.length);
      setRatingCount(ratingsRes.data.length);
    }

    if (driverRes.data) {
      const { count } = await supabase.from('deliveries').select('id', { count: 'exact', head: true })
        .eq('driver_id', driverRes.data.id).eq('status', 'completed');
      setTotalDeliveries(count ?? 0);
    }

    setLoading(false);
  };

  const savePixKey = async () => {
    if (!driver) return;
    setSavingPix(true);
    const { error } = await supabase.from('drivers').update({ pix_key: pixKey.trim() || null } as any).eq('id', driver.id);
    setSavingPix(false);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Chave PIX salva!' });
      setDriver(prev => prev ? { ...prev, pix_key: pixKey.trim() || null } : prev);
    }
  };

  const detectPixType = (key: string): string => {
    if (!key) return '';
    if (/^\d{11}$/.test(key.replace(/[.\-]/g, ''))) return 'CPF/Telefone';
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key)) return 'E-mail';
    if (/^[a-f0-9\-]{32,36}$/i.test(key)) return 'Aleatória';
    return 'Chave PIX';
  };

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const vehicleIcons: Record<string, React.ReactNode> = {
    motorcycle: <Bike className="h-5 w-5" />,
    bicycle: <Bike className="h-5 w-5" />,
    car: <Car className="h-5 w-5" />,
  };
  const vehicleLabels: Record<string, string> = { motorcycle: 'Moto', bicycle: 'Bicicleta', car: 'Carro' };

  const initials = profile?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? '?';

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-20 w-20 rounded-full" />
          <Skeleton className="h-6 w-40" />
        </div>
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Avatar and name */}
      <div className="flex flex-col items-center pt-2">
        <AvatarUpload
          userId={user!.id}
          currentUrl={profile?.avatar_url ?? null}
          initials={initials}
          onUploaded={(url) => setProfile(prev => prev ? { ...prev, avatar_url: url } : prev)}
        />
        <h1 className="text-xl font-bold mt-3">{profile?.full_name}</h1>
        {avgRating !== null && (
          <div className="flex items-center gap-1 mt-1">
            {[1, 2, 3, 4, 5].map(i => (
              <Star key={i} className={`h-4 w-4 ${i <= Math.round(avgRating) ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground/30'}`} />
            ))}
            <span className="text-sm font-semibold ml-1">{avgRating.toFixed(1)}</span>
            <span className="text-xs text-muted-foreground">({ratingCount})</span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <Package className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-lg font-bold">{totalDeliveries}</p>
            <p className="text-[10px] text-muted-foreground">Entregas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Star className="h-5 w-5 mx-auto text-yellow-500 mb-1" />
            <p className="text-lg font-bold">{avgRating?.toFixed(1) ?? '-'}</p>
            <p className="text-[10px] text-muted-foreground">Avaliação</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Calendar className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-lg font-bold">{profile?.created_at ? format(new Date(profile.created_at), 'MMM/yy', { locale: ptBR }) : '-'}</p>
            <p className="text-[10px] text-muted-foreground">Membro</p>
          </CardContent>
        </Card>
      </div>

      {/* Personal info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Dados Pessoais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Telefone</p>
              <p className="text-sm font-medium">{profile?.phone ?? '-'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">CPF</p>
              <p className="text-sm font-medium">{driver?.cpf ?? '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vehicle */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Veículo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            {vehicleIcons[driver?.vehicle_type ?? ''] ?? <Truck className="h-4 w-4 text-muted-foreground" />}
            <div>
              <p className="text-xs text-muted-foreground">Tipo</p>
              <p className="text-sm font-medium">{vehicleLabels[driver?.vehicle_type ?? ''] ?? '-'}</p>
            </div>
          </div>
          {driver?.plate && (
            <div className="flex items-center gap-3">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Placa</p>
                <p className="text-sm font-medium">{driver.plate}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Push Notifications Toggle */}
      <Card>
        <CardContent className="py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Notificações Push</span>
          </div>
          <PushNotificationToggle />
        </CardContent>
      </Card>

      {/* Notifications */}
      {notifications.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bell className="h-4 w-4" /> Notificações Recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {notifications.map(n => (
              <div
                key={n.id}
                className={`p-3 rounded-lg text-sm cursor-pointer transition-colors ${n.read ? 'bg-muted/50' : 'bg-primary/5 border border-primary/20'}`}
                onClick={() => !n.read && markAsRead(n.id)}
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium">{n.title}</p>
                  {!n.read && <div className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {format(new Date(n.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Button variant="destructive" className="w-full" onClick={signOut}>
        <LogOut className="h-4 w-4 mr-2" /> Sair da conta
      </Button>
    </div>
  );
};

export default DriverProfile;
