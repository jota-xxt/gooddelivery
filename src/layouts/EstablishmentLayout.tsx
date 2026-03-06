import { Outlet } from 'react-router-dom';
import BottomNav from '@/components/BottomNav';
import { Package, Clock, User } from 'lucide-react';

const items = [
  { label: 'Pedidos', icon: <Package className="h-5 w-5" />, path: '/establishment' },
  { label: 'Histórico', icon: <Clock className="h-5 w-5" />, path: '/establishment/history' },
  { label: 'Perfil', icon: <User className="h-5 w-5" />, path: '/establishment/profile' },
];

const EstablishmentLayout = () => {
  return (
    <div className="min-h-screen pb-20">
      <Outlet />
      <BottomNav items={items} />
    </div>
  );
};

export default EstablishmentLayout;
