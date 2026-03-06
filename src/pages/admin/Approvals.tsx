import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Check, X, UserCheck, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PendingUser {
  user_id: string;
  full_name: string;
  phone: string;
  role: string;
  created_at: string;
}

const getInitials = (name: string) =>
  name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();

const AdminApprovals = () => {
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchPending = async () => {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, phone, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (!profiles || profiles.length === 0) { setLoading(false); return; }

    const userIds = profiles.map(p => p.user_id);
    const { data: roles } = await supabase.from('user_roles').select('user_id, role').in('user_id', userIds);
    const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) ?? []);

    const enriched: PendingUser[] = profiles.map(p => ({
      ...p,
      role: roleMap.get(p.user_id) ?? 'unknown',
    }));

    setPending(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchPending(); }, []);

  const handleApproval = async (userId: string, approve: boolean) => {
    setProcessing(userId);
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
    setProcessing(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Aprovações Pendentes</h1>
        {!loading && pending.length > 0 && (
          <Badge className="bg-primary text-primary-foreground text-sm px-3">
            {pending.length}
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : pending.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="rounded-full bg-success/10 p-4 w-fit mx-auto mb-4">
              <UserCheck className="h-8 w-8 text-success" />
            </div>
            <p className="text-lg font-medium">Tudo em dia!</p>
            <p className="text-sm text-muted-foreground mt-1">Nenhum cadastro pendente de aprovação.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {pending.map((user) => (
            <Card
              key={user.user_id}
              className={`transition-all duration-300 hover:shadow-md ${processing === user.user_id ? 'opacity-50 scale-[0.98]' : ''}`}
            >
              <CardContent className="flex items-center gap-4 py-4">
                <Avatar className="h-11 w-11">
                  <AvatarFallback className={user.role === 'driver' ? 'bg-blue-500/10 text-blue-600' : 'bg-warning/10 text-warning'}>
                    {getInitials(user.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{user.full_name}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-sm text-muted-foreground">{user.phone}</span>
                    <Badge variant="secondary" className="text-xs">
                      {user.role === 'driver' ? 'Entregador' : 'Estabelecimento'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {format(new Date(user.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleApproval(user.user_id, true)}
                    disabled={processing === user.user_id}
                    className="gap-1"
                  >
                    <Check className="h-4 w-4" /> Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleApproval(user.user_id, false)}
                    disabled={processing === user.user_id}
                    className="gap-1"
                  >
                    <X className="h-4 w-4" /> Rejeitar
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
