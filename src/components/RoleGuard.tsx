import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface RoleGuardProps {
  allowedRoles: string[];
  children: React.ReactNode;
}

const RoleGuard = ({ allowedRoles, children }: RoleGuardProps) => {
  const { user, role, status, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (status !== 'approved') return <Navigate to="/pending-approval" replace />;
  if (!role || !allowedRoles.includes(role)) return <Navigate to="/" replace />;

  return <>{children}</>;
};

export default RoleGuard;
