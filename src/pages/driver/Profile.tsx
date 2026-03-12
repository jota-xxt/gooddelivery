import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Phone, CreditCard, Bell, LogOut, QrCode, Save, Package, Star, Calendar, CheckCircle } from 'lucide-react';
import { PushNotificationToggle } from '@/components/PushNotificationToggle';
import { useToast } from '@/hooks/use-toast';
import { format, startOfWeek, subWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import QuickStats from '@/components/QuickStats';
import ProfileHeader from '@/components/driver/ProfileHeader';
import ProfileVehicleCard from '@/components/driver/ProfileVehicleCard';
import ProfilePerformance from '@/components/driver/ProfilePerformance';

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
  const [acceptanceRate, setAcceptanceRate] = useState<number | null>(null);
  const [thisWeekDeliveries, setThisWeekDeliveries] = useState(0);
  const [lastWeekDeliveries, setLastWeekDeliveries] = useState(0);
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
      setDriver(driverRes.data);
      setPixKey(driverRes.data.pix_key ?? '');
    }
    setNotifications(notifsRes.data ?? []);

    if (ratingsRes.data && ratingsRes.data.length > 0) {
      setAvgRating(ratingsRes.data.reduce((s, r) => s + r.rating, 0) / ratingsRes.data.length);
      setRatingCount(ratingsRes.data.length);
    }

    if (driverRes.data) {
      // Total deliveries
      const { count: totalCount } = await supabase.from('deliveries').select('id', { count: 'exact', head: true })
        .eq('driver_id', driverRes.data.id).eq('status', 'completed');
      setTotalDeliveries(totalCount ?? 0);

      // Acceptance rate from offers
      const { data: offers } = await supabase.from('delivery_offers').select('status').eq('driver_id', driverRes.data.id);
      if (offers && offers.length > 0) {
        const accepted = offers.filter(o => o.status === 'accepted').length;
        setAcceptanceRate(Math.round((accepted / offers.length) * 100));
      }

      // Weekly performance
      const now = new Date();
      const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
      const lastWeekStart = subWeeks(thisWeekStart, 1);

      const [thisWeekRes, lastWeekRes] = await Promise.all([
        supabase.from('deliveries').select('id', { count: 'exact', head: true })
          .eq('driver_id', driverRes.data.id).eq('status', 'completed')
          .gte('delivered_at', thisWeekStart.toISOString()),
        supabase.from('deliveries').select('id', { count: 'exact', head: true })
          .eq('driver_id', driverRes.data.id).eq('status', 'completed')
          .gte('delivered_at', lastWeekStart.toISOString())
          .lt('delivered_at', thisWeekStart.toISOString()),
      ]);
      setThisWeekDeliveries(thisWeekRes.count ?? 0);
      setLastWeekDeliveries(lastWeekRes.count ?? 0);
    }

    setLoading(false);
  };

  const savePixKey = async () => {
    if (!driver) return;
    setSavingPix(true);
    const { error } = await supabase.from('drivers').update({ pix_key: pixKey.trim() || null }).eq('id', driver.id);
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

  const initials = profile?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? '?';

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-52 rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        {[1, 2].map(i => <Skeleton key={i} className="h-28 rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5 pb-24">
      {/* Gradient header with avatar, name, rating, level */}
      <ProfileHeader
        userId={user!.id}
        avatarUrl={profile?.avatar_url ?? null}
        initials={initials}
        fullName={profile?.full_name ?? ''}
        avgRating={avgRating}
        ratingCount={ratingCount}
        totalDeliveries={totalDeliveries}
        onAvatarUploaded={(url) => setProfile(prev => prev ? { ...prev, avatar_url: url } : prev)}
      />

      {/* Stats grid */}
      <QuickStats stats={[
        { label: 'Entregas', value: totalDeliveries, icon: Package, color: 'bg-primary/10 text-primary' },
        { label: 'Avaliação', value: avgRating?.toFixed(1) ?? '-', icon: Star, color: 'bg-yellow-100 text-yellow-600' },
        { label: 'Aceitação', value: acceptanceRate !== null ? `${acceptanceRate}%` : '-', icon: CheckCircle, color: 'bg-green-100 text-green-600' },
        { label: 'Membro', value: profile?.created_at ? format(new Date(profile.created_at), 'MMM/yy', { locale: ptBR }) : '-', icon: Calendar, color: 'bg-blue-100 text-blue-600' },
      ]} />

      {/* Weekly performance */}
      <ProfilePerformance thisWeek={thisWeekDeliveries} lastWeek={lastWeekDeliveries} />

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
      {driver && <ProfileVehicleCard vehicleType={driver.vehicle_type} plate={driver.plate} />}

      {/* PIX Key */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <QrCode className="h-4 w-4" /> Chave PIX
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Input
              placeholder="CPF, e-mail, telefone ou chave aleatória"
              value={pixKey}
              onChange={e => setPixKey(e.target.value)}
              className="text-sm"
            />
            {pixKey && (
              <p className="text-[10px] text-muted-foreground">Tipo detectado: {detectPixType(pixKey)}</p>
            )}
          </div>
          <Button
            size="sm"
            className="w-full gap-1.5"
            onClick={savePixKey}
            disabled={savingPix || pixKey === (driver?.pix_key ?? '')}
          >
            <Save className="h-3.5 w-3.5" />
            {savingPix ? 'Salvando...' : 'Salvar Chave PIX'}
          </Button>
        </CardContent>
      </Card>

      {/* Push notifications */}
      <Card>
        <CardContent className="py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Notificações Push</span>
          </div>
          <PushNotificationToggle />
        </CardContent>
      </Card>

      {/* Recent notifications */}
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
