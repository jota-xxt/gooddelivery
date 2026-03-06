import { Outlet } from 'react-router-dom';
import AdminSidebar from '@/components/AdminSidebar';

const AdminLayout = () => {
  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 p-4 lg:p-8 overflow-auto pt-16 lg:pt-4">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
