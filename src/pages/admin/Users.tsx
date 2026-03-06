import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Search } from 'lucide-react';

interface UserRow {
  user_id: string;
  full_name: string;
  phone: string;
  status: string;
  role: string;
}

const AdminUsers = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, phone, status');
    if (!profiles) { setLoading(false); return; }

    const enriched: UserRow[] = [];
    for (const p of profiles) {
      const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', p.user_id).single();
      enriched.push({ ...p, role: roleData?.role ?? 'unknown' });
    }
    setUsers(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const toggleSuspend = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'suspended' ? 'approved' : 'suspended';
    const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('user_id', userId);
    if (error) { toast.error('Erro'); return; }
    toast.success(newStatus === 'suspended' ? 'Usuário suspenso' : 'Usuário reativado');
    setUsers((prev) => prev.map((u) => u.user_id === userId ? { ...u, status: newStatus } : u));
  };

  const filtered = users.filter((u) =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  );

  const statusLabel: Record<string, string> = {
    pending: 'Pendente', approved: 'Aprovado', rejected: 'Rejeitado', suspended: 'Suspenso',
  };
  const statusVariant = (s: string) => {
    if (s === 'approved') return 'default' as const;
    if (s === 'suspended' || s === 'rejected') return 'destructive' as const;
    return 'secondary' as const;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Gerenciar Usuários</h1>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou tipo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>
      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((user) => (
            <Card key={user.user_id}>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="font-semibold">{user.full_name}</p>
                  <p className="text-sm text-muted-foreground">{user.phone}</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline">{user.role === 'driver' ? 'Entregador' : user.role === 'establishment' ? 'Estabelecimento' : 'Admin'}</Badge>
                    <Badge variant={statusVariant(user.status)}>{statusLabel[user.status] ?? user.status}</Badge>
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
