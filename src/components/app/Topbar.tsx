"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CurrentUser, getUserInitials, logout } from "@/lib/auth-client";

export interface TopbarProps {
  onMobileMenuOpen: () => void;
  user?: CurrentUser | null;
}

const PAGE_TITLES: Record<string, string> = {
  "/": "Home",
  "/discover": "Discover",
  "/investigations": "Investigations",
  "/leads": "Leads",
  "/intelligence": "Intelligence",
  "/automations": "Automations",
  "/providers": "Providers",
  "/sources": "Sources",
  "/settings": "Settings",
  "/history": "History",
};

export function Topbar({ onMobileMenuOpen, user }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    if (!isUserMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsUserMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isUserMenuOpen]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await logout();
    router.replace("/");
    router.refresh();
  };

  const pageTitle =
    PAGE_TITLES[pathname] ||
    (pathname.startsWith("/leads/") ? "Lead" : "VANTAGE");

  const isGuest = Boolean(user?.anonymous);

  return (
    <header className="h-14 border-b border-border/80 bg-surface/70 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMobileMenuOpen}
          className="p-1.5 rounded-lg text-subtle hover:text-foreground hover:bg-surface-2 lg:hidden transition-colors"
          aria-label="Open sidebar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-sm sm:text-base font-semibold text-foreground tracking-tight truncate">
            {pageTitle}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="relative">
          {isUserMenuOpen && (
            <button
              type="button"
              className="fixed inset-0 z-40 cursor-default"
              onClick={() => setIsUserMenuOpen(false)}
              aria-hidden="true"
            />
          )}
          <button
            onClick={() => setIsUserMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={isUserMenuOpen}
            className="relative z-50 flex items-center gap-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            title={user ? user.name : "Account"}
          >
            <span className="w-8 h-8 rounded-full bg-accent/15 border border-accent/35 text-accent font-mono font-extrabold text-xs flex items-center justify-center uppercase">
              {user ? getUserInitials(user) : "··"}
            </span>
          </button>

          {isUserMenuOpen && user && (
            <div
              role="menu"
              className="absolute right-0 top-11 z-50 w-56 border border-border rounded-xl bg-surface shadow-overlay overflow-hidden animate-fade-in"
            >
              <div className="px-3 py-3 border-b border-border bg-surface-2/40">
                <p className="text-xs font-semibold text-foreground truncate">{user.name}</p>
                <p className="text-[10px] text-subtle truncate mt-0.5">
                  {isGuest ? "Guest workspace · free entry" : user.email ?? user.role}
                </p>
              </div>
              {!isGuest && (
                <div className="p-1.5">
                  <button
                    role="menuitem"
                    onClick={() => void handleSignOut()}
                    disabled={isSigningOut}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-muted hover:text-danger hover:bg-danger/10 disabled:opacity-50 transition-colors"
                  >
                    {isSigningOut ? "Signing out..." : "Sign out"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
