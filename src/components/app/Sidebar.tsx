"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../../lib/utils";
import { CurrentUser, getUserInitials } from "@/lib/auth-client";

export interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
  user?: CurrentUser | null;
}

const PRIMARY_NAV = [
  { label: "Home", href: "/", icon: "M4 6h6v6H4zm10 0h6v6h-6zM4 16h6v6H4zm10 0h6v6h-6z" },
  { label: "Discover", href: "/discover", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
  { label: "Leads", href: "/leads", icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2" },
  { label: "Jobs", href: "/jobs", icon: "M20 7h-4V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zm-10-2h4v2h-4V5zm-2 7h8" },
  { label: "History", href: "/history", icon: "M3 12a9 9 0 1018 0 9 9 0 00-18 0zm9-5v5l3 2" },
];

const MORE_NAV = [
  { label: "Investigations", href: "/investigations", icon: "M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h7" },
  { label: "Intelligence", href: "/intelligence", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10" },
  { label: "Automations", href: "/automations", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
  { label: "Sources", href: "/sources", icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" },
  { label: "Settings", href: "/settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543-.94-3.31.826-2.37 2.37a1.724 1.724 0 00-1.065 2.572c-1.756.426-1.756 2.924 0 3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
];

const MOBILE_NAV = [
  { label: "Home", href: "/", icon: "M4 11l8-7 8 7v8a2 2 0 01-2 2H6a2 2 0 01-2-2z" },
  { label: "Discover", href: "/discover", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
  { label: "Leads", href: "/leads", icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2" },
  { label: "Jobs", href: "/jobs", icon: "M20 7h-4V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zm-10-2h4v2h-4V5zm-2 7h8" },
  { label: "History", href: "/history", icon: "M3 12a9 9 0 1018 0 9 9 0 00-18 0zm9-5v5l3 2" },
];

function NavIcon({ path, active = false }: { path: string; active?: boolean }) {
  return (
    <svg className={cn("w-4 h-4 shrink-0", active ? "text-accent" : "text-subtle")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={path} />
    </svg>
  );
}

function NavLink({
  item,
  pathname,
  isCollapsed,
  onMobileClose,
}: {
  item: { label: string; href: string; icon: string };
  pathname: string;
  isCollapsed: boolean;
  onMobileClose: () => void;
}) {
  const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
  return (
    <Link
      href={item.href}
      onClick={onMobileClose}
      className={cn(
        "flex items-center gap-3 px-2.5 py-2 rounded-md text-xs font-medium transition-all group relative",
        active ? "bg-accent/10 text-accent font-semibold border border-accent/30" : "text-muted hover:text-foreground hover:bg-surface-2/70"
      )}
    >
      <NavIcon path={item.icon} active={active} />
      {!isCollapsed && <span className="truncate flex-1">{item.label}</span>}
    </Link>
  );
}

export function Sidebar({ isCollapsed, onToggleCollapse, isMobileOpen, onMobileClose, user }: SidebarProps) {
  const pathname = usePathname();
  return (
    <>
      {isMobileOpen && <div className="fixed inset-0 z-40 bg-black/80 lg:hidden" onClick={onMobileClose} />}
      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-40 bg-surface border-r border-border flex flex-col transition-all duration-300",
          isCollapsed ? "w-16" : "w-60",
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="h-14 border-b border-border flex items-center justify-between px-3.5 shrink-0">
          <Link href="/" onClick={onMobileClose} className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded bg-accent/15 border border-accent/40 flex items-center justify-center shrink-0">
              <span className="font-mono font-extrabold text-accent text-sm">VT</span>
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-extrabold tracking-widest text-foreground text-sm font-mono leading-none">VANTAGE</span>
                <span className="text-[10px] uppercase font-mono text-accent mt-0.5">Lead intelligence</span>
              </div>
            )}
          </Link>
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex p-1 rounded hover:bg-surface-2 text-subtle hover:text-foreground shrink-0"
            aria-label={isCollapsed ? "Expand navigation" : "Collapse navigation"}
          >
            <svg className={cn("w-4 h-4 transition-transform", isCollapsed && "rotate-180")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-4 no-scrollbar" aria-label="Primary navigation">
          <div className="space-y-1">
            {!isCollapsed && (
              <p className="px-2.5 pt-1 text-[10px] font-mono uppercase tracking-wider text-subtle">Main</p>
            )}
            {PRIMARY_NAV.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} isCollapsed={isCollapsed} onMobileClose={onMobileClose} />
            ))}
          </div>
          <div className="space-y-1">
            {!isCollapsed && (
              <p className="px-2.5 pt-1 text-[10px] font-mono uppercase tracking-wider text-subtle">More</p>
            )}
            {MORE_NAV.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} isCollapsed={isCollapsed} onMobileClose={onMobileClose} />
            ))}
          </div>
        </nav>

        <div className="p-2 border-t border-border space-y-2 shrink-0 bg-surface-2/20">
          <Link
            href="/settings"
            onClick={onMobileClose}
            className={cn(
              "flex items-center gap-2.5 p-1.5 rounded-md border border-transparent hover:border-border hover:bg-surface-2 transition-all",
              isCollapsed && "justify-center p-1"
            )}
          >
            <div className="w-7 h-7 rounded-full bg-surface-2 border border-border-strong text-accent flex items-center justify-center font-mono font-bold text-xs shrink-0 uppercase">
              {user ? getUserInitials(user) : "··"}
            </div>
            {!isCollapsed && user && (
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-semibold text-foreground truncate leading-none">{user.name}</span>
                <span className="text-[10px] text-subtle truncate mt-0.5 capitalize">
                  {user.anonymous ? "Guest · free entry" : `${user.role}${user.organizationId ? " · Team" : " · Personal"}`}
                </span>
              </div>
            )}
          </Link>
        </div>
      </aside>

      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 left-0 right-0 z-30 lg:hidden border-t border-border bg-surface/95 backdrop-blur px-2 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] grid grid-cols-5 gap-1"
      >
        {MOBILE_NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-medium",
                active ? "text-accent bg-accent/10" : "text-subtle"
              )}
            >
              <NavIcon path={item.icon} active={active} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
