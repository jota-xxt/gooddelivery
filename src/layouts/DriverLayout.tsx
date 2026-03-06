import { Outlet } from 'react-router-dom';
import BottomNav from '@/components/BottomNav';
import { Home, DollarSign, User } from 'lucide-react';

const items = [
  { label: 'Início', icon: <Home className="h-5 w-5" />, path: '/driver' },
  { label: 'Ganhos', icon: <DollarSign className="h-5 w-5" />, path: '/driver/earnings' },
  { label: 'Perfil', icon: <User className="h-5 w-5" />, path: '/driver/profile' },
];

const DriverLayout = () => {
  return (
    <div className="min-h-screen pb-20">
      <Outlet />
      <BottomNav items={items} />
    </div>
  );
};

export default DriverLayout;
