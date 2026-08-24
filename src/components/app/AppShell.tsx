"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { cn } from "../../lib/utils";
import { CurrentUser, fetchCurrentUser, getCurrentPath } from "@/lib/auth-client";
import { Button } from "@/components/ui/Button";

export interface AppShellProps { children: React.ReactNode; }
const PUBLIC_PATHS = ["/login", "/signup", "/verify-email"];
type SessionStatus = "checking" | "authenticated" | "unauthenticated" | "error";

function AuthLoadingScreen() {
  return <div className="min-h-screen bg-background text-foreground font-sans flex items-center justify-center"><div className="flex flex-col items-center gap-3"><svg className="animate-spin h-6 w-6 text-accent" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg><span className="text-[10px] font-mono uppercase tracking-[0.25em] text-subtle">Checking session</span></div></div>;
}

function AuthErrorScreen({ onRetry }: { onRetry: () => void }) {
  return <div className="min-h-screen bg-background text-foreground font-sans flex items-center justify-center p-6"><div className="border border-border rounded-lg bg-surface p-6 max-w-sm text-center space-y-3"><h1 className="text-sm font-bold text-foreground font-mono uppercase tracking-wide">Session unavailable</h1><p className="text-xs text-subtle">VANTAGE could not confirm your sign-in status. Check your connection and try again.</p><div className="flex items-center justify-center gap-2"><Button size="sm" variant="secondary" onClick={onRetry}>Retry</Button><Link href="/login" className="inline-flex items-center justify-center h-8 px-3 rounded-md border border-border text-xs font-medium text-foreground hover:bg-surface-2 transition-colors">Go to sign in</Link></div></div></div>;
}

function clearSharedAccountState() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem("vantage:last-discover-run-id");
    window.sessionStorage.removeItem("vantage:discover-results-snapshot");
    window.localStorage.removeItem("vantage-ui-preferences");
  } catch {
    // Storage can be disabled; server-side authorization remains authoritative.
  }
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [status, setStatus] = useState<SessionStatus>("checking");
  const applySessionResult = useCallback((result: CurrentUser | null | "error") => {
    if (result === "error") setStatus("error");
    else if (result) { setUser(result); setStatus("authenticated"); }
    else { setUser(null); setStatus("unauthenticated"); }
  }, []);
  const checkSession = useCallback((): Promise<void> => fetchCurrentUser().then(applySessionResult).catch(() => applySessionResult("error")), [applySessionResult]);

  useEffect(() => {
    if (PUBLIC_PATHS.includes(pathname)) return;
    let cancelled = false;
    fetchCurrentUser().then((result) => { if (!cancelled) applySessionResult(result); }).catch(() => { if (!cancelled) applySessionResult("error"); });
    return () => { cancelled = true; };
  }, [pathname, applySessionResult]);

  useEffect(() => {
    if (PUBLIC_PATHS.includes(pathname)) return;
    if (!user?.id) {
      if (status === "unauthenticated") clearSharedAccountState();
      return;
    }
    const previousUserId = window.sessionStorage.getItem("vantage:active-user-id");
    if (previousUserId && previousUserId !== user.id) clearSharedAccountState();
    window.sessionStorage.setItem("vantage:active-user-id", user.id);
  }, [user?.id, status, pathname]);

  useEffect(() => {
    if (status !== "unauthenticated" || PUBLIC_PATHS.includes(pathname)) return;
    const nextPath = getCurrentPath();
    const suffix = nextPath && nextPath !== "/login" ? `?next=${encodeURIComponent(nextPath)}` : "";
    router.replace(`/login${suffix}`);
  }, [status, pathname, router]);
  const handleRetry = () => { setStatus("checking"); void checkSession(); };
  if (PUBLIC_PATHS.includes(pathname)) return <>{children}</>;
  if (status === "checking") return <AuthLoadingScreen />;
  if (status === "error") return <AuthErrorScreen onRetry={handleRetry} />;
  if (status === "unauthenticated") return <AuthLoadingScreen />;
  return <div className="min-h-screen bg-background text-foreground flex flex-col font-sans"><Sidebar isCollapsed={isCollapsed} onToggleCollapse={() => setIsCollapsed(!isCollapsed)} isMobileOpen={isMobileOpen} onMobileClose={() => setIsMobileOpen(false)} user={user} /><div className={cn("flex-1 flex flex-col transition-all duration-300", isCollapsed ? "lg:pl-16" : "lg:pl-60")}><Topbar onMobileMenuOpen={() => setIsMobileOpen(true)} user={user} /><main className="flex-1 p-4 sm:p-6 pb-24 lg:pb-6 max-w-7xl w-full mx-auto animate-fade-in">{children}</main></div></div>;
}
