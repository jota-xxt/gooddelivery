import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { Search, Package, Download, XCircle, ChevronDown, Clock, CheckCircle2, Truck, MapPin, Ban } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DeliveryFull {
  id: string;
  customer_name: string | null;
  delivery_address: string;
  delivery_fee: number;
  status: string;
  urgency: string;
  observations: string | null;
  cancel_reason: string | null;
  created_at: string;
  accepted_at: string | null;
  collected_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  establishment_id: string;
  driver_id: string | null;
  establishment_name?: string;
  driver_name?: string;
}

const statusLabel: Record<string, string> = {
  searching: 'Buscando', accepted: 'Aceito', collecting: 'Coletando',
  delivering: 'Entregando', completed: 'Concluído', cancelled: 'Cancelado',
};
const statusColor: Record<string, string> = {
  searching: 'bg-warning/15 text-warning', accepted: 'bg-blue-500/15 text-blue-600',
  collecting: 'bg-purple-500/15 text-purple-600', delivering: 'bg-primary/15 text-primary',
  completed: 'bg-success/15 text-success', cancelled: 'bg-destructive/15 text-destructive',
};

const AdminDeliveries = () => {
  const [deliveries, setDeliveries] = useState<DeliveryFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const fetchDeliveries = useCallback(async () => {
    const { data: dels } = await supabase
      .from('deliveries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (!dels || dels.length === 0) { setDeliveries([]); setLoading(false); return; }

    const estIds = [...new Set(dels.map(d => d.establishment_id))];
    const driverIds = [...new Set(dels.filter(d => d.driver_id).map(d => d.driver_id!))];

    const [{ data: ests }, { data: drivers }] = await Promise.all([
      supabase.from('establishments').select('id, business_name').in('id', estIds),
      driverIds.length > 0
        ? supabase.from('drivers').select('id, user_id').in('id', driverIds)
        : Promise.resolve({ data: [] as { id: string; user_id: string }[] }),
    ]);

    let driverNames: Record<string, string> = {};
    if (drivers && drivers.length > 0) {
      const userIds = drivers.map(d => d.user_id);
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
      const pMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) ?? []);
      for (const d of drivers) { driverNames[d.id] = pMap.get(d.user_id) ?? 'Entregador'; }
    }

    const estMap = new Map(ests?.map(e => [e.id, e.business_name]) ?? []);
    setDeliveries(dels.map(d => ({
      ...d,
      establishment_name: estMap.get(d.establishment_id) ?? 'Desconhecido',
      driver_name: d.driver_id ? (driverNames[d.driver_id] ?? 'Desconhecido') : undefined,
    })));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDeliveries();
    const debounceRef = { timer: null as ReturnType<typeof setTimeout> | null };
    const debouncedFetch = () => {
      if (debounceRef.timer) clearTimeout(debounceRef.timer);
      debounceRef.timer = setTimeout(() => fetchDeliveries(), 2000);
    };
    const channel = supabase
      .channel('admin-deliveries-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, debouncedFetch)
      .subscribe();
    return () => {
      if (debounceRef.timer) clearTimeout(debounceRef.timer);
      supabase.removeChannel(channel);
    };
  }, [fetchDeliveries]);

  const filtered = useMemo(() => {
    return deliveries.filter(d => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (d.customer_name?.toLowerCase().includes(q)) ||
          d.delivery_address.toLowerCase().includes(q) ||
          d.establishment_name?.toLowerCase().includes(q) ||
          d.driver_name?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [deliveries, search, statusFilter]);

  const handleCancel = async () => {
    if (!cancelId) return;
    const { error } = await supabase.from('deliveries').update({
      status: 'cancelled' as any,
      cancelled_at: new Date().toISOString(),
      cancel_reason: cancelReason || 'Cancelado pelo admin',
    }).eq('id', cancelId);
    if (error) { toast.error('Erro ao cancelar'); }
    else { toast.success('Entrega cancelada'); }
    setCancelId(null);
    setCancelReason('');
  };

  const exportCSV = () => {
    const header = 'ID,Cliente,Endereço,Estabelecimento,Entregador,Valor,Status,Criado em\n';
    const rows = filtered.map(d =>
      `"${d.id}","${d.customer_name ?? ''}","${d.delivery_address}","${d.establishment_name}","${d.driver_name ?? ''}",${Number(d.delivery_fee).toFixed(2)},"${statusLabel[d.status]}","${format(new Date(d.created_at), 'dd/MM/yyyy HH:mm')}"`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'entregas.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (d: string | null) => d ? format(new Date(d), "dd/MM HH:mm", { locale: ptBR }) : null;

  const counts = useMemo(() => ({
    total: deliveries.length,
    active: deliveries.filter(d => !['completed', 'cancelled'].includes(d.status)).length,
    completed: deliveries.filter(d => d.status === 'completed').length,
    cancelled: deliveries.filter(d => d.status === 'cancelled').length,
  }), [deliveries]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gerenciar Entregas</h1>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-1" /> CSV
        </Button>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="py-3 text-center">
          <p className="text-2xl font-bold">{counts.total}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 text-center">
          <p className="text-2xl font-bold text-primary">{counts.active}</p>
          <p className="text-xs text-muted-foreground">Ativas</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 text-center">
          <p className="text-2xl font-bold text-success">{counts.completed}</p>
          <p className="text-xs text-muted-foreground">Concluídas</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 text-center">
          <p className="text-2xl font-bold text-destructive">{counts.cancelled}</p>
          <p className="text-xs text-muted-foreground">Canceladas</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por cliente, endereço, estabelecimento..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {Object.entries(statusLabel).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Deliveries */}
      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma entrega encontrada.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(d => (
            <Collapsible key={d.id} open={openId === d.id} onOpenChange={(o) => setOpenId(o ? d.id : null)}>
              <Card className="overflow-hidden hover:shadow-md transition-shadow">
                <CollapsibleTrigger asChild>
                  <CardContent className="flex items-center gap-3 py-3 cursor-pointer">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{d.driver_name || d.establishment_name}</p>
                        <Badge className={`text-xs ${statusColor[d.status]}`}>{statusLabel[d.status]}</Badge>
                        {d.urgency === 'urgent' && <Badge variant="destructive" className="text-xs">Urgente</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{d.establishment_name} → {d.delivery_address}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-sm">R$ {Number(d.delivery_fee).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(d.created_at), 'dd/MM HH:mm')}</p>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openId === d.id ? 'rotate-180' : ''}`} />
                  </CardContent>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-6 pb-4 border-t pt-3 space-y-3">
                    {/* Timeline */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Timeline</p>
                      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Criado: {formatDate(d.created_at)}</span>
                        {d.accepted_at && <span className="flex items-center gap-1 text-blue-600"><CheckCircle2 className="h-3 w-3" /> Aceito: {formatDate(d.accepted_at)}</span>}
                        {d.collected_at && <span className="flex items-center gap-1 text-purple-600"><Package className="h-3 w-3" /> Coletado: {formatDate(d.collected_at)}</span>}
                        {d.delivered_at && <span className="flex items-center gap-1 text-success"><Truck className="h-3 w-3" /> Entregue: {formatDate(d.delivered_at)}</span>}
                        {d.cancelled_at && <span className="flex items-center gap-1 text-destructive"><Ban className="h-3 w-3" /> Cancelado: {formatDate(d.cancelled_at)}</span>}
                      </div>
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Estabelecimento:</span> {d.establishment_name}</div>
                      {d.driver_name && <div><span className="text-muted-foreground">Entregador:</span> {d.driver_name}</div>}
                      <div className="flex items-start gap-1"><MapPin className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" /> {d.delivery_address}</div>
                      {d.observations && <div><span className="text-muted-foreground">Obs:</span> {d.observations}</div>}
                      {d.cancel_reason && <div className="text-destructive"><span className="text-muted-foreground">Motivo cancelamento:</span> {d.cancel_reason}</div>}
                    </div>

                    {/* Actions */}
                    {!['completed', 'cancelled'].includes(d.status) && (
                      <Button variant="destructive" size="sm" onClick={() => setCancelId(d.id)}>
                        <XCircle className="h-4 w-4 mr-1" /> Cancelar Entrega
                      </Button>
                    )}
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      )}

      {/* Cancel Dialog */}
      <AlertDialog open={!!cancelId} onOpenChange={(o) => !o && setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Entrega</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <Input placeholder="Motivo do cancelamento (opcional)" value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Cancelar Entrega</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminDeliveries;
