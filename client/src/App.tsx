import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import AppLayout from "./components/AppLayout";
import AdminGuard from "./components/AdminGuard";
import Dashboard from "./pages/Dashboard";
import AllJobs from "./pages/AllJobs";
import EstimatePage from "./pages/EstimatePage";
import NewEstimate from "./pages/NewEstimate";

function Router() {
  return (
    <Switch>
      {/* Public estimate page — clean slug URL sent to customers */}
      <Route path="/estimate/:slug" component={EstimatePage} />

      {/* App pages with sidebar layout — password-protected */}
      <Route path="/">
        <AdminGuard><AppLayout><Dashboard /></AppLayout></AdminGuard>
      </Route>
      <Route path="/new-estimate">
        <AdminGuard><AppLayout><NewEstimate /></AppLayout></AdminGuard>
      </Route>
      <Route path="/all-jobs">
        <AdminGuard><AppLayout><AllJobs /></AppLayout></AdminGuard>
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
