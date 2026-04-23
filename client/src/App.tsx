import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import AppLayout from "./components/AppLayout";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import AllJobs from "./pages/AllJobs";
import CalendarPage from "./pages/CalendarPage";
import EstimatePage from "./pages/EstimatePage";
import TestPipeline from "./pages/TestPipeline";
import NewEstimate from "./pages/NewEstimate";
import OnboardCompany from "./pages/OnboardCompany";
import OnboardingAudit from "./pages/OnboardingAudit";
import PreviewEstimate from "./pages/PreviewEstimate";
import ActivateStub from "./pages/ActivateStub";

function Router() {
  return (
    <Switch>
      {/* Public estimate page — clean slug URL sent to customers */}
      <Route path="/estimate/:slug" component={EstimatePage} />

      {/* Pipeline test console for founder — no sidebar */}
      <Route path="/test-pipeline" component={TestPipeline} />

      {/* App pages with sidebar layout */}
      <Route path="/">
        <AppLayout><Dashboard /></AppLayout>
      </Route>
      <Route path="/new-estimate">
        <AppLayout><NewEstimate /></AppLayout>
      </Route>
      <Route path="/onboard">
        <AppLayout><OnboardCompany /></AppLayout>
      </Route>
      <Route path="/preview/:slug">
        <AppLayout><PreviewEstimate /></AppLayout>
      </Route>
      <Route path="/activate/:slug">
        <AppLayout><ActivateStub /></AppLayout>
      </Route>
      <Route path="/all-jobs">
        <AppLayout><AllJobs /></AppLayout>
      </Route>
      <Route path="/calendar">
        <AppLayout><CalendarPage /></AppLayout>
      </Route>
      <Route path="/audit/:slug">
        <AppLayout><OnboardingAudit /></AppLayout>
      </Route>
      <Route path="/audit">
        <AppLayout><OnboardingAudit /></AppLayout>
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
