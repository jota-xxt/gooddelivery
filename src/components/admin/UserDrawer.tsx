import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, Ban, RotateCcw, Star, Phone, Calendar, Package, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { UserRow } from './userTypes';

interface UserDrawerProps {
  user: UserRow | null;
  onClose: () => void;
  onUserUpdate: (userId: string, updates: Partial<UserRow>) => void;
  getAvatarUrl: (url: string | null) => string | undefined;
}

const getInitials = (name: string) =>
  name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();

const statusLabel: Record<string, string> = {
  pending: 'Pendente', approved: 'Ativo', rejected: 'Rejeitado', suspended: 'Suspenso',
};
const statusVariant = (s: string) => {
  if (s === 'approved') return 'default' as const;
  if (s === 'suspended' || s === 'rejected') return 'destructive' as const;
  return 'secondary' as const;
};
const roleLabel: Record<string, string> = {
  driver: 'Entregador', establishment: 'Estabelecimento', admin: 'Admin',
};

export const UserDrawer = ({ user, onClose, onUserUpdate, getAvatarUrl }: UserDrawerProps) => {
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('dados');

  // Sync form when user changes
  const onOpenChange = (open: boolean) => {
    if (!open) onClose();
    else if (user) {
      setEditName(user.full_name);
      setEditPhone(user.phone ?? '');
      setActiveTab('dados');
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const updates: Record<string, string> = {};
    if (editName !== user.full_name) updates.full_name = editName;
    if (editPhone !== (user.phone ?? '')) updates.phone = editPhone;
    if (Object.keys(updates).length === 0) { setSaving(false); return; }
    const { error } = await supabase.from('profiles').update(updates).eq('user_id', user.user_id);
    if (error) toast.error('Erro ao salvar');
    else {
      toast.success('Dados atualizados');
      onUserUpdate(user.user_id, updates);
    }
    setSaving(false);
  };

  const toggleSuspend = async () => {
    if (!user) return;
    const newStatus = user.status === 'suspended' ? 'approved' : 'suspended';
    const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('user_id', user.user_id);
    if (error) { toast.error('Erro'); return; }
    toast.success(newStatus === 'suspended' ? 'Usuário suspenso' : 'Usuário reativado');
    onUserUpdate(user.user_id, { status: newStatus });
  };

  // Initialize form on open
  if (user && editName === '' && editPhone === '') {
    setEditName(user.full_name);
    setEditPhone(user.phone ?? '');
  }

  return (
    <Sheet open={!!user} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col overflow-hidden">
        {user && (
          <>
            {/* Header */}
            <div className="p-5 pb-4 bg-gradient-to-b from-primary/5 to-transparent">
              <SheetHeader className="mb-4">
                <SheetTitle className="text-base">Detalhes do Usuário</SheetTitle>
              </SheetHeader>
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 ring-2 ring-primary/20 shadow-md">
                  <AvatarImage src={getAvatarUrl(user.avatar_url)} />
                  <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">
                    {getInitials(user.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-lg truncate">{user.full_name}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-xs">{roleLabel[user.role] ?? user.role}</Badge>
                    <Badge variant={statusVariant(user.status)} className="text-xs">
                      {statusLabel[user.status] ?? user.status}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Quick stats */}
              <div className="flex gap-4 mt-4 text-xs text-muted-foreground">
                {user.avg_rating !== undefined && (
                  <span className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                    <span className="font-medium text-foreground">{user.avg_rating.toFixed(1)}</span>
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />
                  {user.phone || '—'}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {format(new Date(user.created_at), 'dd/MM/yy', { locale: ptBR })}
                </span>
              </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
              <div className="px-5">
                <TabsList className="w-full grid grid-cols-3 h-10">
                  <TabsTrigger value="dados" className="text-xs">Dados</TabsTrigger>
                  <TabsTrigger value="entregas" className="text-xs">Entregas</TabsTrigger>
                  <TabsTrigger value="avaliacoes" className="text-xs">Avaliações</TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 overflow-y-auto px-5 pb-5">
                <TabsContent value="dados" className="mt-4 space-y-4">
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome completo</label>
                      <Input value={editName} onChange={e => setEditName(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Telefone</label>
                      <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} />
                    </div>
                    <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
                      <Save className="h-4 w-4" /> Salvar Alterações
                    </Button>
                  </div>

                  {user.role !== 'admin' && (
                    <>
                      <Separator />
                      <Button
                        variant={user.status === 'suspended' ? 'outline' : 'destructive'}
                        className="w-full gap-2"
                        onClick={toggleSuspend}
                      >
                        {user.status === 'suspended' ? <RotateCcw className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                        {user.status === 'suspended' ? 'Reativar Usuário' : 'Suspender Usuário'}
                      </Button>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="entregas" className="mt-4">
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                    <Package className="h-10 w-10 mb-3 opacity-40" />
                    <p className="text-sm font-medium">Histórico de entregas</p>
                    <p className="text-xs mt-1">Em breve você poderá ver todas as entregas deste usuário aqui.</p>
                  </div>
                </TabsContent>

                <TabsContent value="avaliacoes" className="mt-4">
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                    <MessageSquare className="h-10 w-10 mb-3 opacity-40" />
                    <p className="text-sm font-medium">Avaliações recebidas</p>
                    <p className="text-xs mt-1">Em breve você poderá ver todas as avaliações deste usuário aqui.</p>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
