import { useState, useEffect, useCallback, createContext, useContext } from "react";
import LoginPage from "@/pages/LoginPage";

interface AdminSession {
  companySlug: string;
  email: string;
}

const AdminContext = createContext<AdminSession | null>(null);

export function useAdminSession(): AdminSession {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdminSession must be used within AdminGuard");
  return ctx;
}

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");
  const [session, setSession] = useState<AdminSession | null>(null);

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/check", { credentials: "include" });
      const data = await res.json();
      if (data.authenticated) {
        setSession({ companySlug: data.companySlug, email: data.email });
        setStatus("authenticated");
      } else {
        setStatus("unauthenticated");
      }
    } catch {
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  const handleLoginSuccess = (companySlug: string) => {
    setSession({ companySlug, email: "" });
    setStatus("authenticated");
  };

  if (status === "loading") return null;
  if (status === "unauthenticated") return <LoginPage onSuccess={handleLoginSuccess} />;
  return (
    <AdminContext.Provider value={session}>
      {children}
    </AdminContext.Provider>
  );
}
