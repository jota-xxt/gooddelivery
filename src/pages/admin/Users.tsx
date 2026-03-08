import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Search, Users, Truck, Store, Star, Package, X, Save } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UserRow {
  user_id: string;
  full_name: string;
  phone: string;
  status: string;
  role: string;
  avatar_url: string | null;
  created_at: string;
  total_deliveries?: number;
  avg_rating?: number;
}

const getInitials = (name: string) =>
  name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();

const AdminUsers = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchUsers = async () => {
    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, phone, status, avatar_url, created_at');
    if (!profiles || profiles.length === 0) { setLoading(false); return; }

    const userIds = profiles.map(p => p.user_id);
    const [{ data: roles }, { data: ratings }] = await Promise.all([
      supabase.from('user_roles').select('user_id, role').in('user_id', userIds),
      supabase.from('ratings').select('to_user_id, rating'),
    ]);

    const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) ?? []);

    // Avg ratings per user
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
    setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, status: newStatus } : u));
    if (selectedUser?.user_id === userId) setSelectedUser(prev => prev ? { ...prev, status: newStatus } : null);
  };

  const handleSave = async () => {
    if (!selectedUser) return;
    setSaving(true);
    const updates: any = {};
    if (editName !== selectedUser.full_name) updates.full_name = editName;
    if (editPhone !== (selectedUser.phone ?? '')) updates.phone = editPhone;
    if (Object.keys(updates).length === 0) { setSaving(false); return; }
    const { error } = await supabase.from('profiles').update(updates).eq('user_id', selectedUser.user_id);
    if (error) { toast.error('Erro ao salvar'); }
    else {
      toast.success('Dados atualizados');
      setUsers(prev => prev.map(u => u.user_id === selectedUser.user_id ? { ...u, ...updates } : u));
      setSelectedUser(prev => prev ? { ...prev, ...updates } : null);
    }
    setSaving(false);
  };

  const openDrawer = (user: UserRow) => {
    setSelectedUser(user);
    setEditName(user.full_name);
    setEditPhone(user.phone ?? '');
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

  const statusLabel: Record<string, string> = { pending: 'Pendente', approved: 'Aprovado', rejected: 'Rejeitado', suspended: 'Suspenso' };
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

  const getAvatarUrl = (url: string | null) => {
    if (!url) return undefined;
    const { data } = supabase.storage.from('avatars').getPublicUrl(url);
    return data.publicUrl;
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

      <div className="flex items-center justify-between flex-wrap gap-2">
        {/* Status filter */}
        <div className="flex gap-2 flex-wrap">
          {['all', 'approved', 'pending', 'suspended', 'rejected'].map(s => (
            <Button key={s} variant={statusFilter === s ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(s)}>
              {s === 'all' ? 'Todos' : statusLabel[s]}
            </Button>
          ))}
        </div>
        {/* Sort */}
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Ordenar" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at">Mais recente</SelectItem>
            <SelectItem value="name">Nome A-Z</SelectItem>
            <SelectItem value="rating">Melhor avaliação</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum usuário encontrado.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(user => (
            <Card key={user.user_id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => openDrawer(user)}>
              <CardContent className="flex items-center gap-4 py-4">
                <Avatar className="h-11 w-11">
                  <AvatarImage src={getAvatarUrl(user.avatar_url)} />
                  <AvatarFallback className={roleIcon[user.role] ?? 'bg-muted text-muted-foreground'}>
                    {getInitials(user.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{user.full_name}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{user.phone}</span>
                    {user.avg_rating !== undefined && (
                      <span className="flex items-center gap-0.5 text-warning"><Star className="h-3 w-3 fill-warning" />{user.avg_rating.toFixed(1)}</span>
                    )}
                  </div>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {user.role === 'driver' ? 'Entregador' : user.role === 'establishment' ? 'Estabelecimento' : 'Admin'}
                    </Badge>
                    <Badge variant={statusVariant(user.status)} className="text-xs">
                      {statusLabel[user.status] ?? user.status}
                    </Badge>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground hidden sm:block">
                  {format(new Date(user.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                </div>
                {user.role !== 'admin' && (
                  <Button size="sm" variant={user.status === 'suspended' ? 'default' : 'destructive'}
                    onClick={e => { e.stopPropagation(); toggleSuspend(user.user_id, user.status); }}>
                    {user.status === 'suspended' ? 'Reativar' : 'Suspender'}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Drawer */}
      <Sheet open={!!selectedUser} onOpenChange={(o) => !o && setSelectedUser(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selectedUser && (
            <>
              <SheetHeader>
                <SheetTitle>Detalhes do Usuário</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={getAvatarUrl(selectedUser.avatar_url)} />
                    <AvatarFallback className={`text-lg ${roleIcon[selectedUser.role] ?? ''}`}>
                      {getInitials(selectedUser.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-bold text-lg">{selectedUser.full_name}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {selectedUser.role === 'driver' ? 'Entregador' : selectedUser.role === 'establishment' ? 'Estabelecimento' : 'Admin'}
                      </Badge>
                      <Badge variant={statusVariant(selectedUser.status)} className="text-xs">
                        {statusLabel[selectedUser.status] ?? selectedUser.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                {selectedUser.avg_rating !== undefined && (
                  <div className="flex items-center gap-2 text-sm">
                    <Star className="h-4 w-4 fill-warning text-warning" />
                    <span className="font-medium">{selectedUser.avg_rating.toFixed(1)}</span>
                    <span className="text-muted-foreground">avaliação média</span>
                  </div>
                )}

                <div className="text-sm text-muted-foreground">
                  Cadastrado em {format(new Date(selectedUser.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </div>

                {/* Edit form */}
                <div className="space-y-3 border-t pt-4">
                  <p className="text-sm font-semibold">Editar Dados</p>
                  <div>
                    <label className="text-xs text-muted-foreground">Nome</label>
                    <Input value={editName} onChange={e => setEditName(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Telefone</label>
                    <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} />
                  </div>
                  <Button onClick={handleSave} disabled={saving} className="w-full gap-1">
                    <Save className="h-4 w-4" /> Salvar Alterações
                  </Button>
                </div>

                {selectedUser.role !== 'admin' && (
                  <Button variant={selectedUser.status === 'suspended' ? 'default' : 'destructive'} className="w-full"
                    onClick={() => toggleSuspend(selectedUser.user_id, selectedUser.status)}>
                    {selectedUser.status === 'suspended' ? 'Reativar Usuário' : 'Suspender Usuário'}
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default AdminUsers;
