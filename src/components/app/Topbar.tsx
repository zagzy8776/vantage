"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CurrentUser, getUserInitials, logout } from "@/lib/auth-client";

export interface TopbarProps {
  onMobileMenuOpen: () => void;
  user?: CurrentUser | null;
}

const PAGE_TITLES: Record<string, string> = {
  "/": "Overview",
  "/discover": "Discover Leads",
  "/investigations": "Investigations",
  "/leads": "Lead Pipeline & Directory",
  "/intelligence": "Market Intelligence",
  "/automations": "Automations & Scanners",
  "/providers": "AI & Service Providers",
  "/sources": "Data Sources",
  "/settings": "Platform Settings",
};

export function Topbar({ onMobileMenuOpen, user }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
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
    // Session revoked server-side and cookie cleared - re-render the shell
    router.replace("/login");
    router.refresh();
  };

  const pageTitle =
    PAGE_TITLES[pathname] ||
    (pathname.startsWith("/leads/") ? "Lead Deep Analysis" : "VANTAGE");

  return (
    <header className="h-14 border-b border-border bg-surface/80 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6">
      <div className="flex items-center gap-3">
        {/* Mobile menu toggle */}
        <button
          onClick={onMobileMenuOpen}
          className="p-1.5 rounded-md text-subtle hover:text-foreground hover:bg-surface-2 lg:hidden transition-colors"
          aria-label="Open sidebar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Current page title */}
        <div className="flex items-center gap-2">
          <h1 className="text-sm sm:text-base font-bold text-foreground tracking-tight">
            {pageTitle}
          </h1>
          <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase bg-surface-2 border border-border text-subtle rounded">
            Live
          </span>
        </div>
      </div>

      {/* Center/Right controls: Search, Status, Profile */}
      <div className="flex items-center gap-3">
        {/* Global search */}
        <div className="relative hidden md:flex items-center">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Global search (leads, domains, categories)..."
            className="w-64 lg:w-80 bg-surface-2 border border-border rounded-md text-xs text-foreground placeholder:text-subtle/70 pl-8 pr-12 py-1.5 focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/40 transition-all"
          />
          <svg
            className="w-3.5 h-3.5 text-subtle absolute left-2.5 pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <kbd className="absolute right-2 text-[10px] font-mono text-subtle bg-surface px-1.5 py-0.5 rounded border border-border">
            ⌘K
          </kbd>
        </div>

        {/* Notification / Status indicator */}
        <button
          className="relative p-2 rounded-md text-subtle hover:text-foreground hover:bg-surface-2 transition-colors"
          title="System Notifications"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent animate-pulse" />
        </button>

        <div className="h-4 w-[1px] bg-border" />

        {/* User menu */}
        <div className="relative flex items-center">
          {isUserMenuOpen && (
            <div
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
            title={user ? `${user.name} (${user.email})` : "Account"}
          >
            <span className="w-7 h-7 rounded-full bg-accent/20 border border-accent/40 text-accent font-mono font-extrabold text-xs flex items-center justify-center uppercase">
              {user ? getUserInitials(user) : "··"}
            </span>
          </button>

          {isUserMenuOpen && user && (
            <div
              role="menu"
              className="absolute right-0 top-10 z-50 w-56 border border-border rounded-lg bg-surface shadow-lg overflow-hidden animate-fade-in"
            >
              <div className="px-3 py-3 border-b border-border bg-surface-2/30">
                <p className="text-xs font-semibold text-foreground truncate">{user.name}</p>
                <p className="text-[10px] text-subtle truncate">{user.email}</p>
                <span className="inline-block mt-1.5 px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold uppercase tracking-wide bg-accent/15 border border-accent/30 text-accent">
                  {user.role}
                  {user.organizationId ? " · org" : ""}
                </span>
              </div>
              <div className="p-1.5">
                <button
                  role="menuitem"
                  onClick={() => void handleSignOut()}
                  disabled={isSigningOut}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs font-medium text-muted hover:text-danger hover:bg-danger/10 disabled:opacity-50 transition-colors"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  {isSigningOut ? "Signing out..." : "Sign Out"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
