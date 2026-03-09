import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import RoleGuard from "@/components/RoleGuard";

import Login from "./pages/Login";
import Register from "./pages/Register";
import PendingApproval from "./pages/PendingApproval";
import NotFound from "./pages/NotFound";
import Install from "./pages/Install";

import AdminLayout from "./layouts/AdminLayout";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminApprovals from "./pages/admin/Approvals";
import AdminUsers from "./pages/admin/Users";
import AdminFinancial from "./pages/admin/Financial";
import AdminSettings from "./pages/admin/Settings";
import AdminDeliveries from "./pages/admin/Deliveries";

import AdminMapOverview from "./pages/admin/MapOverview";

import DriverLayout from "./layouts/DriverLayout";
import DriverHome from "./pages/driver/Home";
import DriverHistory from "./pages/driver/History";
import DriverEarnings from "./pages/driver/Earnings";
import DriverProfile from "./pages/driver/Profile";

import EstablishmentLayout from "./layouts/EstablishmentLayout";
import EstablishmentOrders from "./pages/establishment/Orders";
import EstablishmentHistory from "./pages/establishment/History";
import EstablishmentFinancial from "./pages/establishment/Financial";
import EstablishmentProfile from "./pages/establishment/Profile";

const queryClient = new QueryClient();

const ProtectedRoutes = () => {
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

  if (role === 'admin') return <Navigate to="/admin" replace />;
  if (role === 'driver') return <Navigate to="/driver" replace />;
  if (role === 'establishment') return <Navigate to="/establishment" replace />;

  return <Navigate to="/login" replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/pending-approval" element={<PendingApproval />} />
            <Route path="/install" element={<Install />} />

            <Route path="/admin" element={
              <RoleGuard allowedRoles={['admin']}>
                <AdminLayout />
              </RoleGuard>
            }>
              <Route index element={<AdminDashboard />} />
              <Route path="deliveries" element={<AdminDeliveries />} />
              <Route path="approvals" element={<AdminApprovals />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="financial" element={<AdminFinancial />} />
              <Route path="settings" element={<AdminSettings />} />
              
              <Route path="map" element={<AdminMapOverview />} />
            </Route>

            <Route path="/driver" element={
              <RoleGuard allowedRoles={['driver']}>
                <DriverLayout />
              </RoleGuard>
            }>
              <Route index element={<DriverHome />} />
              <Route path="history" element={<DriverHistory />} />
              <Route path="earnings" element={<DriverEarnings />} />
              <Route path="profile" element={<DriverProfile />} />
            </Route>

            <Route path="/establishment" element={
              <RoleGuard allowedRoles={['establishment']}>
                <EstablishmentLayout />
              </RoleGuard>
            }>
              <Route index element={<EstablishmentOrders />} />
              <Route path="history" element={<EstablishmentHistory />} />
              <Route path="financial" element={<EstablishmentFinancial />} />
              <Route path="profile" element={<EstablishmentProfile />} />
            </Route>

            <Route path="/" element={<ProtectedRoutes />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
