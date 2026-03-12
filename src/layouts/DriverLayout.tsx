import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import BottomNav from '@/components/BottomNav';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Home, Clock, DollarSign, User, Bell } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

const items = [
  { label: 'Início', icon: <Home className="h-5 w-5" />, path: '/driver' },
  { label: 'Histórico', icon: <Clock className="h-5 w-5" />, path: '/driver/history' },
  { label: 'Ganhos', icon: <DollarSign className="h-5 w-5" />, path: '/driver/earnings' },
  { label: 'Perfil', icon: <User className="h-5 w-5" />, path: '/driver/profile' },
];

const DriverLayout = () => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('full_name').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => setName(data?.full_name ?? ''));
    supabase.from('drivers').select('is_online').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => setIsOnline(data?.is_online ?? false));
    supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('read', false)
      .then(({ count }) => setUnreadCount(count ?? 0));

    const channel = supabase
      .channel('driver-layout-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, (payload: any) => {
        if (payload.new?.user_id === user.id) {
          setIsOnline(payload.new.is_online ?? false);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload: any) => {
        if (payload.new?.user_id === user.id) {
          setUnreadCount(prev => prev + 1);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const firstName = name.split(' ')[0];

  return (
    <div className="min-h-screen pb-20 bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-primary">
              <AvatarFallback className="bg-primary text-primary-foreground font-bold text-sm">
                {initials || '?'}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm text-muted-foreground">Olá,</p>
              <p className="font-semibold leading-tight">{firstName || 'Entregador'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className={`h-2.5 w-2.5 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/40'}`} />
              <span className="text-xs font-medium text-muted-foreground">{isOnline ? 'Online' : 'Offline'}</span>
            </div>
            <div className="relative">
              <Bell className="h-5 w-5 text-muted-foreground" />
              {unreadCount > 0 && (
                <Badge className="absolute -top-2 -right-2 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      <Outlet />
      <BottomNav items={items} />
    </div>
  );
};

export default DriverLayout;
