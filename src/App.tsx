import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/contexts/AppContext";
import AppLayout from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import ComingSoon from "@/pages/ComingSoon";
import CampaignsPage from "@/pages/Campaigns";
import ClientsPage from "@/pages/ClientsPage";
import ProjectsPage from "@/pages/ProjectsPage";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppProvider>
        <BrowserRouter>
          <AppLayout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/clients" element={<ClientsPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/campaigns" element={<CampaignsPage />} />
              <Route path="/ads" element={<ComingSoon title="Ads" />} />
              <Route path="/timeline" element={<ComingSoon title="Timeline" />} />
              <Route path="/tasks" element={<ComingSoon title="Tasks" />} />
              <Route path="/performance" element={<ComingSoon title="Performance" />} />
              <Route path="/integrations" element={<ComingSoon title="Integrations" />} />
              <Route path="/reports" element={<ComingSoon title="Reports" />} />
              <Route path="/calendar" element={<ComingSoon title="Calendar" />} />
              <Route path="/creative" element={<ComingSoon title="Creative" />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppLayout>
        </BrowserRouter>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
