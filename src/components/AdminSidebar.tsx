import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Users, Settings, DollarSign, Menu, MapPin, Package } from 'lucide-react';
import logo from '@/assets/logo.png';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const navItems = [
  { label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" />, path: '/admin' },
  { label: 'Entregas', icon: <Package className="h-5 w-5" />, path: '/admin/deliveries' },
  { label: 'Aprovações', icon: <Users className="h-5 w-5" />, path: '/admin/approvals' },
  { label: 'Usuários', icon: <Users className="h-5 w-5" />, path: '/admin/users' },
  { label: 'Financeiro', icon: <DollarSign className="h-5 w-5" />, path: '/admin/financial' },
  { label: 'Mapa', icon: <MapPin className="h-5 w-5" />, path: '/admin/map' },
  { label: 'Configurações', icon: <Settings className="h-5 w-5" />, path: '/admin/settings' },
];

const NavContent = ({ onNavigate }: { onNavigate?: () => void }) => {
  const location = useLocation();
  const { signOut } = useAuth();

  return (
    <>
      <div className="flex items-center gap-3 p-6 border-b">
        <img src={logo} alt="Good Delivery" className="h-10 w-10 object-contain rounded-xl" />
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
              onClick={onNavigate}
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
    </>
  );
};

const AdminSidebar = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center gap-3 px-4 py-3 border-b bg-card">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64 flex flex-col">
            <NavContent onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary overflow-hidden">
            <img src={logo} alt="Good Delivery" className="h-6 w-6 object-contain" />
          </div>
          <span className="font-bold text-sm">Good Delivery</span>
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-r bg-card h-screen sticky top-0">
        <NavContent />
      </aside>
    </>
  );
};

export default AdminSidebar;
