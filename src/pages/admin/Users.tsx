import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Search, Users, Truck, Store, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserCard } from '@/components/admin/UserCard';
import { UserDrawer } from '@/components/admin/UserDrawer';
import type { UserRow } from '@/components/admin/userTypes';

const AdminUsers = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);

  const fetchUsers = async () => {
    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, phone, status, avatar_url, created_at');
    if (!profiles || profiles.length === 0) { setLoading(false); return; }

    const userIds = profiles.map(p => p.user_id);
    const [{ data: roles }, { data: ratings }] = await Promise.all([
      supabase.from('user_roles').select('user_id, role').in('user_id', userIds),
      supabase.from('ratings').select('to_user_id, rating'),
    ]);

    const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) ?? []);
    const ratingMap = new Map<string, { sum: number; count: number }>();
    ratings?.forEach(r => {
      const curr = ratingMap.get(r.to_user_id) ?? { sum: 0, count: 0 };
      curr.sum += r.rating; curr.count++;
      ratingMap.set(r.to_user_id, curr);
    });

    setUsers(profiles.map(p => ({
      ...p,
      role: roleMap.get(p.user_id) ?? 'unknown',
      avg_rating: ratingMap.has(p.user_id) ? ratingMap.get(p.user_id)!.sum / ratingMap.get(p.user_id)!.count : undefined,
    })));
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const toggleSuspend = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'suspended' ? 'approved' : 'suspended';
    const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('user_id', userId);
    if (error) { toast.error('Erro'); return; }
    toast.success(newStatus === 'suspended' ? 'Usuário suspenso' : 'Usuário reativado');
    handleUserUpdate(userId, { status: newStatus });
  };

  const handleUserUpdate = (userId: string, updates: Partial<UserRow>) => {
    setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, ...updates } : u));
    setSelectedUser(prev => prev?.user_id === userId ? { ...prev, ...updates } : prev);
  };

  const getAvatarUrl = (url: string | null) => {
    if (!url) return undefined;
    const { data } = supabase.storage.from('avatars').getPublicUrl(url);
    return data.publicUrl;
  };

  const counts = useMemo(() => ({
    all: users.length,
    driver: users.filter(u => u.role === 'driver').length,
    establishment: users.filter(u => u.role === 'establishment').length,
  }), [users]);

  const filtered = useMemo(() => {
    let result = users.filter(u => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      if (search && !u.full_name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    if (sortBy === 'name') result.sort((a, b) => a.full_name.localeCompare(b.full_name));
    else if (sortBy === 'created_at') result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    else if (sortBy === 'rating') result.sort((a, b) => (b.avg_rating ?? 0) - (a.avg_rating ?? 0));
    return result;
  }, [users, search, roleFilter, statusFilter, sortBy]);

  const roleChips = [
    { key: 'all', label: 'Todos', icon: Users, count: counts.all },
    { key: 'driver', label: 'Entregadores', icon: Truck, count: counts.driver },
    { key: 'establishment', label: 'Estabelecimentos', icon: Store, count: counts.establishment },
  ];

  const statusChips = [
    { key: 'all', label: 'Todos' },
    { key: 'approved', label: 'Ativos', dot: 'bg-success' },
    { key: 'pending', label: 'Pendentes', dot: 'bg-warning' },
    { key: 'suspended', label: 'Suspensos', dot: 'bg-destructive' },
  ];

  const sortOptions = [
    { key: 'created_at', label: 'Mais recente' },
    { key: 'name', label: 'Nome A-Z' },
    { key: 'rating', label: 'Melhor avaliação' },
  ];

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Title */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Usuários</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{counts.all} cadastrados</p>
      </div>

      {/* Role filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {roleChips.map(chip => (
          <button
            key={chip.key}
            onClick={() => setRoleFilter(chip.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
              roleFilter === chip.key
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                : 'bg-card border border-border text-muted-foreground hover:border-primary/30'
            }`}
          >
            <chip.icon className="h-3.5 w-3.5" />
            {chip.label}
            <Badge variant="secondary" className={`ml-0.5 h-5 px-1.5 text-[10px] ${
              roleFilter === chip.key ? 'bg-primary-foreground/20 text-primary-foreground' : ''
            }`}>
              {chip.count}
            </Badge>
          </button>
        ))}
      </div>

      {/* Search + Filters row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 h-10 rounded-xl bg-card"
          />
        </div>

        {/* Sort + Status in dropdown for mobile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl shrink-0">
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Status</div>
            {statusChips.map(s => (
              <DropdownMenuItem key={s.key} onClick={() => setStatusFilter(s.key)} className={statusFilter === s.key ? 'bg-accent' : ''}>
                {s.dot && <span className={`h-2 w-2 rounded-full ${s.dot} mr-2`} />}
                {s.label}
              </DropdownMenuItem>
            ))}
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-1">Ordenar por</div>
            {sortOptions.map(o => (
              <DropdownMenuItem key={o.key} onClick={() => setSortBy(o.key)} className={sortBy === o.key ? 'bg-accent' : ''}>
                {o.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Active filters */}
      {(statusFilter !== 'all' || sortBy !== 'created_at') && (
        <div className="flex gap-1.5 flex-wrap">
          {statusFilter !== 'all' && (
            <Badge variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => setStatusFilter('all')}>
              {statusChips.find(s => s.key === statusFilter)?.label} ✕
            </Badge>
          )}
          {sortBy !== 'created_at' && (
            <Badge variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => setSortBy('created_at')}>
              {sortOptions.find(o => o.key === sortBy)?.label} ✕
            </Badge>
          )}
        </div>
      )}

      {/* User list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-[76px] rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="font-medium text-muted-foreground">Nenhum usuário encontrado</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Tente ajustar os filtros ou a busca</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(user => (
            <UserCard
              key={user.user_id}
              user={user}
              onView={setSelectedUser}
              onToggleSuspend={toggleSuspend}
              getAvatarUrl={getAvatarUrl}
            />
          ))}
        </div>
      )}

      {/* Drawer */}
      <UserDrawer
        user={selectedUser}
        onClose={() => setSelectedUser(null)}
        onUserUpdate={handleUserUpdate}
        getAvatarUrl={getAvatarUrl}
      />
    </div>
  );
};

export default AdminUsers;
