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
import QAChecklistPage from "@/pages/QAChecklist";
import QAChecklistNewPage from "@/pages/QAChecklistNew";
import QAChecklistViewPage from "@/pages/QAChecklistView";
import AuditPage from "@/pages/AuditPage";
import AssistantPage from "@/pages/AssistantPage";
import AdminPage from "@/pages/AdminPage";
import AuthPage from "@/pages/AuthPage";
import ResetPassword from "@/pages/ResetPassword";
import AcceptInvitePage from "@/pages/AcceptInvitePage";
import SelectWorkspace from "@/pages/SelectWorkspace";
import PendingApproval from "@/pages/PendingApproval";
import AccessDenied from "@/pages/AccessDenied";
import Index from "@/pages/Index";
import TermsPage from "@/pages/TermsPage";
import PrivacyPage from "@/pages/PrivacyPage";
import UnsubscribePage from "@/pages/UnsubscribePage";
import NotFound from "./pages/NotFound.tsx";
import SupportBot from "@/components/support/SupportBot";
import AssistantFAB from "@/components/assistant/AssistantFAB";
import SupportAdminPage from "@/pages/SupportAdminPage";
import { CookieConsent } from "@/components/CookieConsent";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { session, loading, organizations, pendingMemberships, isSuperAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;

  // No active organization at all
  if (!isSuperAdmin && organizations.length === 0) {
    if (pendingMemberships.length > 0) {
      return <PendingApproval memberships={pendingMemberships} />;
    }
    return <AccessDenied message="החשבון שלך אינו משויך לסוכנות פעילה. צור סוכנות חדשה או השתמש בקישור הזמנה." />;
  }

  // After login: if user has multiple workspaces and hasn't picked one this session,
  // send them to the workspace selector.
  const justChose = sessionStorage.getItem('agencyos_workspace_chosen') === '1';
  if (organizations.length > 1 && !justChose) {
    return <Navigate to="/select-workspace" replace />;
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/campaigns" element={<CampaignsPage />} />
        <Route path="/ads" element={<AdsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/support" element={<SupportAdminPage />} />
        <Route path="/timeline" element={<TimelinePage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/performance" element={<PerformancePage />} />
        <Route path="/qa" element={<QAChecklistPage />} />
        <Route path="/qa/new" element={<QAChecklistNewPage />} />
        <Route path="/qa/:id" element={<QAChecklistViewPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/assistant" element={<AssistantPage />} />
        <Route path="/assistant/:threadId" element={<AssistantPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <AssistantFAB />
    </AppLayout>
  );
}

function AuthRoute() {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) return <Navigate to="/dashboard" replace />;
  return <AuthPage />;
}

function WorkspaceSelectRoute() {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (!session) return <Navigate to="/auth" replace />;
  return <SelectWorkspace />;
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
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/unsubscribe" element={<UnsubscribePage />} />

              {/* Auth */}
              <Route path="/auth" element={<AuthRoute />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/accept-invite" element={<AcceptInvitePage />} />
              <Route path="/select-workspace" element={<WorkspaceSelectRoute />} />

              {/* Authenticated app */}
              <Route path="/*" element={<ProtectedRoutes />} />
            </Routes>
            <SupportBot />
            <CookieConsent />
          </BrowserRouter>
        </AppProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
