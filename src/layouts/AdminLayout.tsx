import { Outlet } from 'react-router-dom';
import AdminSidebar from '@/components/AdminSidebar';
import ErrorBoundary from '@/components/ErrorBoundary';

const AdminLayout = () => {
  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 p-4 lg:p-8 overflow-auto pt-20 lg:pt-8">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
};

export default AdminLayout;
