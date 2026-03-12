import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import RoleGuard from "@/components/RoleGuard";
import { lazy, Suspense } from "react";

import Login from "./pages/Login";
import Register from "./pages/Register";
import PendingApproval from "./pages/PendingApproval";
import NotFound from "./pages/NotFound";
import Install from "./pages/Install";
import LandingPage from "./pages/LandingPage";

// Lazy-loaded layouts and pages
const AdminLayout = lazy(() => import("./layouts/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminApprovals = lazy(() => import("./pages/admin/Approvals"));
const AdminUsers = lazy(() => import("./pages/admin/Users"));
const AdminFinancial = lazy(() => import("./pages/admin/Financial"));
const AdminSettings = lazy(() => import("./pages/admin/Settings"));
const AdminDeliveries = lazy(() => import("./pages/admin/Deliveries"));
const AdminMapOverview = lazy(() => import("./pages/admin/MapOverview"));

const DriverLayout = lazy(() => import("./layouts/DriverLayout"));
const DriverHome = lazy(() => import("./pages/driver/Home"));
const DriverHistory = lazy(() => import("./pages/driver/History"));
const DriverEarnings = lazy(() => import("./pages/driver/Earnings"));
const DriverProfile = lazy(() => import("./pages/driver/Profile"));

const EstablishmentLayout = lazy(() => import("./layouts/EstablishmentLayout"));
const EstablishmentOrders = lazy(() => import("./pages/establishment/Orders"));
const EstablishmentHistory = lazy(() => import("./pages/establishment/History"));
const EstablishmentFinancial = lazy(() => import("./pages/establishment/Financial"));
const EstablishmentProfile = lazy(() => import("./pages/establishment/Profile"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

const LazyFallback = () => (
  <div className="flex min-h-screen items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

const ProtectedRoutes = () => {
  const { user, role, status, loading } = useAuth();

  if (loading) return <LazyFallback />;

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
          <Suspense fallback={<LazyFallback />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/pending-approval" element={<PendingApproval />} />
              <Route path="/install" element={<Install />} />
              <Route path="/reset-password" element={<ResetPassword />} />

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

              <Route path="/" element={<LandingPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
