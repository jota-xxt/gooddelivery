import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Users, Settings, DollarSign, XCircle, Truck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

const navItems = [
  { label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" />, path: '/admin' },
  { label: 'Aprovações', icon: <Users className="h-5 w-5" />, path: '/admin/approvals' },
  { label: 'Usuários', icon: <Users className="h-5 w-5" />, path: '/admin/users' },
  { label: 'Financeiro', icon: <DollarSign className="h-5 w-5" />, path: '/admin/financial' },
  { label: 'Cancelamentos', icon: <XCircle className="h-5 w-5" />, path: '/admin/cancellations' },
  { label: 'Configurações', icon: <Settings className="h-5 w-5" />, path: '/admin/settings' },
];

const AdminSidebar = () => {
  const location = useLocation();
  const { signOut } = useAuth();

  return (
    <aside className="hidden lg:flex flex-col w-64 border-r bg-card h-screen sticky top-0">
      <div className="flex items-center gap-3 p-6 border-b">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
          <Truck className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h2 className="font-bold text-sm">Good Delivery</h2>
          <p className="text-xs text-muted-foreground">Admin</p>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t">
        <Button variant="ghost" className="w-full justify-start text-muted-foreground" onClick={signOut}>
          Sair
        </Button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
