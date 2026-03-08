import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { Check, X, UserCheck, Clock, ChevronDown, Truck, Store, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PendingUser {
  user_id: string;
  full_name: string;
  phone: string;
  role: string;
  created_at: string;
  // Extra details
  cpf?: string;
  cnpj?: string;
  vehicle_type?: string;
  plate?: string;
  business_name?: string;
  address?: string;
}

const getInitials = (name: string) =>
  name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();

const vehicleLabel: Record<string, string> = { motorcycle: 'Moto', bicycle: 'Bicicleta', car: 'Carro' };

const AdminApprovals = () => {
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [roleFilter, setRoleFilter] = useState('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);

  const fetchPending = async () => {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, phone, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (!profiles || profiles.length === 0) { setPending([]); setLoading(false); return; }

    const userIds = profiles.map(p => p.user_id);
    const [{ data: roles }, { data: drivers }, { data: establishments }] = await Promise.all([
      supabase.from('user_roles').select('user_id, role').in('user_id', userIds),
      supabase.from('drivers').select('user_id, cpf, vehicle_type, plate').in('user_id', userIds),
      supabase.from('establishments').select('user_id, cnpj, business_name, address').in('user_id', userIds),
    ]);

    const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) ?? []);
    const driverMap = new Map(drivers?.map(d => [d.user_id, d]) ?? []);
    const estMap = new Map(establishments?.map(e => [e.user_id, e]) ?? []);

    const enriched: PendingUser[] = profiles.map(p => {
      const role = roleMap.get(p.user_id) ?? 'unknown';
      const driver = driverMap.get(p.user_id);
      const est = estMap.get(p.user_id);
      return {
        ...p,
        role,
        cpf: driver?.cpf,
        vehicle_type: driver?.vehicle_type,
        plate: driver?.plate ?? undefined,
        cnpj: est?.cnpj,
        business_name: est?.business_name,
        address: est?.address,
      };
    });

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
      const user = pending.find(p => p.user_id === userId);
      if (user?.phone) {
        const cleanPhone = user.phone.replace(/\D/g, '');
        const whatsappPhone = cleanPhone.length === 11 ? `55${cleanPhone}` : cleanPhone;
        supabase.functions.invoke('send-whatsapp', {
          body: { phone: whatsappPhone, template: approve ? 'registration_approved' : 'registration_rejected', vars: { name: user.full_name, role: user.role } },
        }).catch(() => {});
      }
      setPending(prev => prev.filter(p => p.user_id !== userId));
      setSelected(prev => { const n = new Set(prev); n.delete(userId); return n; });
    }
    setProcessing(null);
  };

  const handleBatch = async (approve: boolean) => {
    if (selected.size === 0) return;
    setBatchProcessing(true);
    for (const userId of selected) {
      await handleApproval(userId, approve);
    }
    setBatchProcessing(false);
    setSelected(new Set());
  };

  const toggleSelect = (userId: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(userId)) n.delete(userId); else n.add(userId);
      return n;
    });
  };

  const toggleAll = () => {
    if (selected.size === filteredPending.length) setSelected(new Set());
    else setSelected(new Set(filteredPending.map(p => p.user_id)));
  };

  const filteredPending = useMemo(() => {
    if (roleFilter === 'all') return pending;
    return pending.filter(p => p.role === roleFilter);
  }, [pending, roleFilter]);

  const counts = useMemo(() => ({
    all: pending.length,
    driver: pending.filter(p => p.role === 'driver').length,
    establishment: pending.filter(p => p.role === 'establishment').length,
  }), [pending]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">Aprovações Pendentes</h1>
        {!loading && pending.length > 0 && (
          <Badge className="bg-primary text-primary-foreground text-sm px-3">{pending.length}</Badge>
        )}
      </div>

      {/* Counters + filter */}
      {!loading && pending.length > 0 && (
        <>
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

          <div className="flex items-center justify-between flex-wrap gap-3">
            <Tabs value={roleFilter} onValueChange={setRoleFilter}>
              <TabsList>
                <TabsTrigger value="all">Todos</TabsTrigger>
                <TabsTrigger value="driver">Entregadores</TabsTrigger>
                <TabsTrigger value="establishment">Estabelecimentos</TabsTrigger>
              </TabsList>
            </Tabs>

            {selected.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{selected.size} selecionado(s)</span>
                <Button size="sm" onClick={() => handleBatch(true)} disabled={batchProcessing} className="gap-1">
                  <Check className="h-4 w-4" /> Aprovar Todos
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleBatch(false)} disabled={batchProcessing} className="gap-1">
                  <X className="h-4 w-4" /> Rejeitar Todos
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : filteredPending.length === 0 ? (
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
          {/* Select all */}
          <div className="flex items-center gap-2 px-1">
            <Checkbox checked={selected.size === filteredPending.length && filteredPending.length > 0} onCheckedChange={toggleAll} />
            <span className="text-sm text-muted-foreground">Selecionar todos</span>
          </div>

          {filteredPending.map(user => (
            <Collapsible key={user.user_id} open={openId === user.user_id} onOpenChange={(o) => setOpenId(o ? user.user_id : null)}>
              <Card className={`transition-all duration-300 hover:shadow-md ${processing === user.user_id ? 'opacity-50 scale-[0.98]' : ''}`}>
                <CardContent className="flex items-center gap-3 py-4">
                  <Checkbox checked={selected.has(user.user_id)} onCheckedChange={() => toggleSelect(user.user_id)} onClick={e => e.stopPropagation()} />
                  <Avatar className="h-11 w-11">
                    <AvatarFallback className={user.role === 'driver' ? 'bg-blue-500/10 text-blue-600' : 'bg-warning/10 text-warning'}>
                      {getInitials(user.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <CollapsibleTrigger asChild>
                    <div className="flex-1 min-w-0 cursor-pointer">
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
                        <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${openId === user.user_id ? 'rotate-180' : ''}`} />
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" onClick={() => handleApproval(user.user_id, true)} disabled={processing === user.user_id} className="gap-1">
                      <Check className="h-4 w-4" /> Aprovar
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setRejectId(user.user_id)} disabled={processing === user.user_id} className="gap-1">
                      <X className="h-4 w-4" /> Rejeitar
                    </Button>
                  </div>
                </CardContent>

                <CollapsibleContent>
                  <div className="px-6 pb-4 border-t pt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    {user.role === 'driver' && (
                      <>
                        {user.cpf && <div><span className="text-muted-foreground">CPF:</span> {user.cpf}</div>}
                        {user.vehicle_type && <div><span className="text-muted-foreground">Veículo:</span> {vehicleLabel[user.vehicle_type] ?? user.vehicle_type}</div>}
                        {user.plate && <div><span className="text-muted-foreground">Placa:</span> {user.plate}</div>}
                      </>
                    )}
                    {user.role === 'establishment' && (
                      <>
                        {user.business_name && <div><span className="text-muted-foreground">Razão Social:</span> {user.business_name}</div>}
                        {user.cnpj && <div><span className="text-muted-foreground">CNPJ:</span> {user.cnpj}</div>}
                        {user.address && <div className="sm:col-span-2"><span className="text-muted-foreground">Endereço:</span> {user.address}</div>}
                      </>
                    )}
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      )}

      {/* Reject confirmation */}
      <AlertDialog open={!!rejectId} onOpenChange={(o) => !o && setRejectId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rejeitar Cadastro</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja rejeitar o cadastro de{' '}
              <strong>{pending.find(p => p.user_id === rejectId)?.full_name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (rejectId) handleApproval(rejectId, false); setRejectId(null); }}
            >
              Rejeitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminApprovals;
