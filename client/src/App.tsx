import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CompanyConfigProvider } from "./contexts/CompanyConfigContext";
import AppLayout from "./components/AppLayout";
import AdminGuard from "./components/AdminGuard";
import Dashboard from "./pages/Dashboard";
import AllJobs from "./pages/AllJobs";
import EstimatePage from "./pages/EstimatePage";
import NewEstimate from "./pages/NewEstimate";
import CustomerSetup from "./pages/CustomerSetup";

function Router() {
  return (
    <Switch>
      {/* Public estimate page — clean slug URL sent to customers */}
      <Route path="/estimate/:slug" component={EstimatePage} />

      {/* App pages with sidebar layout — password-protected, company-isolated */}
      <Route path="/">
        <AdminGuard>
          <CompanyConfigProvider>
            <AppLayout><Dashboard /></AppLayout>
          </CompanyConfigProvider>
        </AdminGuard>
      </Route>
      <Route path="/new-estimate">
        <AdminGuard>
          <CompanyConfigProvider>
            <AppLayout><NewEstimate /></AppLayout>
          </CompanyConfigProvider>
        </AdminGuard>
      </Route>
      <Route path="/all-jobs">
        <AdminGuard>
          <CompanyConfigProvider>
            <AppLayout><AllJobs /></AppLayout>
          </CompanyConfigProvider>
        </AdminGuard>
      </Route>

      {/* Customer onboarding form — admin-only, no company config needed */}
      <Route path="/setup">
        <AdminGuard>
          <CustomerSetup />
        </AdminGuard>
      </Route>

      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
