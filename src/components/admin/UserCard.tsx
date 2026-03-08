import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Eye, Edit, Ban, RotateCcw, Star } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { UserRow } from './userTypes';

interface UserCardProps {
  user: UserRow;
  onView: (user: UserRow) => void;
  onToggleSuspend: (userId: string, status: string) => void;
  getAvatarUrl: (url: string | null) => string | undefined;
}

const getInitials = (name: string) =>
  name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();

const roleLabel: Record<string, string> = {
  driver: 'Entregador',
  establishment: 'Estabelecimento',
  admin: 'Admin',
};

const statusLabel: Record<string, string> = {
  pending: 'Pendente',
  approved: 'Ativo',
  rejected: 'Rejeitado',
  suspended: 'Suspenso',
};

const statusDot: Record<string, string> = {
  approved: 'bg-success',
  suspended: 'bg-destructive',
  rejected: 'bg-destructive',
  pending: 'bg-warning',
};

const roleColor: Record<string, string> = {
  driver: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  establishment: 'bg-warning/10 text-warning border-warning/20',
  admin: 'bg-primary/10 text-primary border-primary/20',
};

export const UserCard = ({ user, onView, onToggleSuspend, getAvatarUrl }: UserCardProps) => (
  <div
    className="group relative flex items-center gap-3 p-3 sm:p-4 rounded-2xl bg-card border border-border/60 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 cursor-pointer active:scale-[0.98]"
    onClick={() => onView(user)}
  >
    {/* Avatar */}
    <div className="relative shrink-0">
      <Avatar className="h-12 w-12 ring-2 ring-background shadow-sm">
        <AvatarImage src={getAvatarUrl(user.avatar_url)} />
        <AvatarFallback className={`text-xs font-bold ${roleColor[user.role] ?? 'bg-muted text-muted-foreground'}`}>
          {getInitials(user.full_name)}
        </AvatarFallback>
      </Avatar>
      {/* Status dot */}
      <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card ${statusDot[user.status] ?? 'bg-muted'}`} />
    </div>

    {/* Info */}
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <p className="font-semibold text-sm truncate">{user.full_name}</p>
        {user.avg_rating !== undefined && (
          <span className="flex items-center gap-0.5 text-xs text-warning shrink-0">
            <Star className="h-3 w-3 fill-warning" />
            {user.avg_rating.toFixed(1)}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground truncate mt-0.5">{user.phone || 'Sem telefone'}</p>
      <div className="flex items-center gap-1.5 mt-1.5">
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 font-medium ${roleColor[user.role] ?? ''}`}>
          {roleLabel[user.role] ?? user.role}
        </Badge>
        <span className="text-[10px] text-muted-foreground">
          {format(new Date(user.created_at), 'dd MMM yyyy', { locale: ptBR })}
        </span>
      </div>
    </div>

    {/* Actions dropdown */}
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 opacity-60 group-hover:opacity-100">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(user); }}>
          <Eye className="h-4 w-4 mr-2" /> Ver detalhes
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(user); }}>
          <Edit className="h-4 w-4 mr-2" /> Editar dados
        </DropdownMenuItem>
        {user.role !== 'admin' && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className={user.status === 'suspended' ? 'text-success' : 'text-destructive'}
              onClick={(e) => { e.stopPropagation(); onToggleSuspend(user.user_id, user.status); }}
            >
              {user.status === 'suspended' ? <RotateCcw className="h-4 w-4 mr-2" /> : <Ban className="h-4 w-4 mr-2" />}
              {user.status === 'suspended' ? 'Reativar' : 'Suspender'}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);
