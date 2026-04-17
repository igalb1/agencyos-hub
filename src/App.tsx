import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/contexts/AppContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import IntegrationsPage from "@/pages/IntegrationsPage";
import TimelinePage from "@/pages/TimelinePage";
import TasksPage from "@/pages/TasksPage";
import PerformancePage from "@/pages/PerformancePage";
import ReportsPage from "@/pages/ReportsPage";
import CalendarPage from "@/pages/CalendarPage";
import CampaignsPage from "@/pages/Campaigns";
import ClientsPage from "@/pages/ClientsPage";
import ProjectsPage from "@/pages/ProjectsPage";
import AdsPage from "@/pages/AdsPage";
import SettingsPage from "@/pages/SettingsPage";
import BillingPage from "@/pages/BillingPage";
import AdminPage from "@/pages/AdminPage";
import AuthPage from "@/pages/AuthPage";
import ResetPassword from "@/pages/ResetPassword";
import TrialExpired from "@/pages/TrialExpired";
import Index from "@/pages/Index";
import PricingPage from "@/pages/PricingPage";
import TermsPage from "@/pages/TermsPage";
import PrivacyPage from "@/pages/PrivacyPage";
import RefundPage from "@/pages/RefundPage";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { session, loading, trialExpired } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;
  if (trialExpired) return <TrialExpired />;

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/campaigns" element={<CampaignsPage />} />
        <Route path="/ads" element={<AdsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/timeline" element={<TimelinePage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/performance" element={<PerformancePage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/billing" element={<BillingPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

function AuthRoute() {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) return <Navigate to="/dashboard" replace />;
  return <AuthPage />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <AppProvider>
          <BrowserRouter>
            <Routes>
              {/* Public marketing & legal pages */}
              <Route path="/" element={<Index />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/refund" element={<RefundPage />} />

              {/* Auth */}
              <Route path="/auth" element={<AuthRoute />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Authenticated app — everything else */}
              <Route path="/dashboard/*" element={<ProtectedRoutes />} />
              <Route path="/clients/*" element={<ProtectedRoutes />} />
              <Route path="/projects/*" element={<ProtectedRoutes />} />
              <Route path="/campaigns/*" element={<ProtectedRoutes />} />
              <Route path="/ads/*" element={<ProtectedRoutes />} />
              <Route path="/admin/*" element={<ProtectedRoutes />} />
              <Route path="/timeline/*" element={<ProtectedRoutes />} />
              <Route path="/tasks/*" element={<ProtectedRoutes />} />
              <Route path="/performance/*" element={<ProtectedRoutes />} />
              <Route path="/integrations/*" element={<ProtectedRoutes />} />
              <Route path="/reports/*" element={<ProtectedRoutes />} />
              <Route path="/settings/*" element={<ProtectedRoutes />} />
              <Route path="/calendar/*" element={<ProtectedRoutes />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AppProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
