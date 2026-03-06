import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Check, X } from 'lucide-react';

interface PendingUser {
  user_id: string;
  full_name: string;
  phone: string;
  role: string;
}

const AdminApprovals = () => {
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPending = async () => {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, phone')
      .eq('status', 'pending');

    if (!profiles) { setLoading(false); return; }

    const enriched: PendingUser[] = [];
    for (const p of profiles) {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', p.user_id)
        .single();
      enriched.push({ ...p, role: roleData?.role ?? 'unknown' });
    }

    setPending(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchPending(); }, []);

  const handleApproval = async (userId: string, approve: boolean) => {
    const { error } = await supabase
      .from('profiles')
      .update({ status: approve ? 'approved' : 'rejected' })
      .eq('user_id', userId);

    if (error) {
      toast.error('Erro ao processar');
    } else {
      toast.success(approve ? 'Usuário aprovado!' : 'Usuário rejeitado');
      setPending((prev) => prev.filter((p) => p.user_id !== userId));
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Aprovações Pendentes</h1>
      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : pending.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum cadastro pendente</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {pending.map((user) => (
            <Card key={user.user_id}>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="font-semibold">{user.full_name}</p>
                  <p className="text-sm text-muted-foreground">{user.phone}</p>
                  <Badge variant="secondary" className="mt-1">
                    {user.role === 'driver' ? 'Entregador' : 'Estabelecimento'}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleApproval(user.user_id, true)}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleApproval(user.user_id, false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminApprovals;
