import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Search, Users, Truck, Store } from 'lucide-react';

interface UserRow {
  user_id: string;
  full_name: string;
  phone: string;
  status: string;
  role: string;
}

const getInitials = (name: string) =>
  name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();

const AdminUsers = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, phone, status');
    if (!profiles || profiles.length === 0) { setLoading(false); return; }

    const userIds = profiles.map(p => p.user_id);
    const { data: roles } = await supabase.from('user_roles').select('user_id, role').in('user_id', userIds);
    const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) ?? []);

    setUsers(profiles.map(p => ({ ...p, role: roleMap.get(p.user_id) ?? 'unknown' })));
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const toggleSuspend = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'suspended' ? 'approved' : 'suspended';
    const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('user_id', userId);
    if (error) { toast.error('Erro'); return; }
    toast.success(newStatus === 'suspended' ? 'Usuário suspenso' : 'Usuário reativado');
    setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, status: newStatus } : u));
  };

  const counts = useMemo(() => ({
    all: users.length,
    driver: users.filter(u => u.role === 'driver').length,
    establishment: users.filter(u => u.role === 'establishment').length,
  }), [users]);

  const filtered = useMemo(() => {
    return users.filter(u => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      if (search && !u.full_name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [users, search, roleFilter, statusFilter]);

  const statusLabel: Record<string, string> = {
    pending: 'Pendente', approved: 'Aprovado', rejected: 'Rejeitado', suspended: 'Suspenso',
  };
  const statusVariant = (s: string) => {
    if (s === 'approved') return 'default' as const;
    if (s === 'suspended' || s === 'rejected') return 'destructive' as const;
    return 'secondary' as const;
  };
  const roleIcon: Record<string, string> = {
    driver: 'bg-blue-500/10 text-blue-600',
    establishment: 'bg-warning/10 text-warning',
    admin: 'bg-primary/10 text-primary',
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Gerenciar Usuários</h1>

      {/* Counter chips */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{counts.all} total</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border">
          <Truck className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium">{counts.driver} entregadores</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border">
          <Store className="h-4 w-4 text-warning" />
          <span className="text-sm font-medium">{counts.establishment} estabelecimentos</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Tabs value={roleFilter} onValueChange={setRoleFilter}>
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="driver">Entregadores</TabsTrigger>
            <TabsTrigger value="establishment">Estabelecimentos</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Status filter */}
      <div className="flex gap-2">
        {['all', 'approved', 'pending', 'suspended', 'rejected'].map(s => (
          <Button
            key={s}
            variant={statusFilter === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(s)}
          >
            {s === 'all' ? 'Todos' : statusLabel[s]}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum usuário encontrado com os filtros selecionados.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(user => (
            <Card key={user.user_id} className="hover:shadow-md transition-shadow">
              <CardContent className="flex items-center gap-4 py-4">
                <Avatar className="h-11 w-11">
                  <AvatarFallback className={roleIcon[user.role] ?? 'bg-muted text-muted-foreground'}>
                    {getInitials(user.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{user.full_name}</p>
                  <p className="text-sm text-muted-foreground">{user.phone}</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {user.role === 'driver' ? 'Entregador' : user.role === 'establishment' ? 'Estabelecimento' : 'Admin'}
                    </Badge>
                    <Badge variant={statusVariant(user.status)} className="text-xs">
                      {statusLabel[user.status] ?? user.status}
                    </Badge>
                  </div>
                </div>
                {user.role !== 'admin' && (
                  <Button
                    size="sm"
                    variant={user.status === 'suspended' ? 'default' : 'destructive'}
                    onClick={() => toggleSuspend(user.user_id, user.status)}
                  >
                    {user.status === 'suspended' ? 'Reativar' : 'Suspender'}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
