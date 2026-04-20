import { useState, useEffect, useCallback } from "react";
import LoginPage from "@/pages/LoginPage";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/check", { credentials: "include" });
      const data = await res.json();
      setStatus(data.authenticated ? "authenticated" : "unauthenticated");
    } catch {
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  if (status === "loading") return null;
  if (status === "unauthenticated") return <LoginPage onSuccess={checkAuth} />;
  return <>{children}</>;
}
