"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../../lib/utils";
import { CurrentUser, getUserInitials } from "@/lib/auth-client";

export interface SidebarProps { isCollapsed: boolean; onToggleCollapse: () => void; isMobileOpen: boolean; onMobileClose: () => void; user?: CurrentUser | null; }

const NAV = [
  { label: "Overview", href: "/", icon: "M4 6h6v6H4zm10 0h6v6h-6zM4 16h6v6H4zm10 0h6v6h-6z" },
  { label: "Discover", href: "/discover", badge: "Research", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
  { label: "Investigations", href: "/investigations", badge: "Workspace", icon: "M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h7" },
  { label: "Leads", href: "/leads", icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2" },
  { label: "Intelligence", href: "/intelligence", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10" },
  { label: "Automations", href: "/automations", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
  { label: "Sources", href: "/sources", icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" },
  { label: "Settings", href: "/settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94" },
  { label: "Usage & Billing", href: "/billing", icon: "M3 10h18M7 15h2m2 0h2m2 0h2M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" },
];

export function Sidebar({ isCollapsed, onToggleCollapse, isMobileOpen, onMobileClose, user }: SidebarProps) {
  const pathname = usePathname();
  return (
    <>
      {isMobileOpen && <div className="fixed inset-0 z-40 bg-black/80 lg:hidden" onClick={onMobileClose} />}
      <aside className={cn("fixed top-0 bottom-0 left-0 z-40 bg-surface border-r border-border flex flex-col transition-all duration-300", isCollapsed ? "w-16" : "w-60", isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0")}>
        <div className="h-14 border-b border-border flex items-center justify-between px-3.5 shrink-0">
          <Link href="/" onClick={onMobileClose} className="flex items-center gap-2.5 overflow-hidden"><div className="w-8 h-8 rounded bg-accent/15 border border-accent/40 flex items-center justify-center shrink-0"><span className="font-mono font-extrabold text-accent text-sm">VT</span></div>{!isCollapsed && <div className="flex flex-col min-w-0"><span className="font-extrabold tracking-widest text-foreground text-sm font-mono leading-none">VANTAGE</span><span className="text-[10px] uppercase font-mono text-accent mt-0.5">Research Intelligence</span></div>}</Link>
          <button onClick={onToggleCollapse} className="hidden lg:flex p-1 rounded hover:bg-surface-2 text-subtle hover:text-foreground shrink-0" aria-label={isCollapsed ? "Expand navigation" : "Collapse navigation"}><svg className={cn("w-4 h-4 transition-transform", isCollapsed && "rotate-180")} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg></button>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-1 no-scrollbar" aria-label="Primary navigation">
          {NAV.map((item) => { const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href); return <Link key={item.href} href={item.href} onClick={onMobileClose} className={cn("flex items-center gap-3 px-2.5 py-2 rounded-md text-xs font-medium transition-all group relative", active ? "bg-accent/10 text-accent font-semibold border border-accent/30" : "text-muted hover:text-foreground hover:bg-surface-2/70")}><svg className={cn("w-4 h-4 shrink-0", active ? "text-accent" : "text-subtle group-hover:text-foreground")} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={item.icon} /></svg>{!isCollapsed && <span className="truncate flex-1">{item.label}</span>}{!isCollapsed && item.badge && <span className={cn("px-1.5 py-0.2 rounded text-[10px] font-mono", active ? "bg-accent/20 text-accent font-semibold" : "bg-surface-2 text-subtle")}>{item.badge}</span>}</Link>; })}
        </nav>
        <div className="p-2 border-t border-border space-y-2 shrink-0 bg-surface-2/20">
          <div className={cn("rounded border border-border/80 p-2 flex items-center gap-2 bg-surface-2/50", isCollapsed && "justify-center px-1")}><span className="relative flex h-2 w-2 shrink-0"><span className="relative inline-flex rounded-full h-2 w-2 bg-success" /></span>{!isCollapsed && <div className="flex flex-col min-w-0 flex-1"><span className="text-[10px] font-mono font-medium text-foreground leading-none">RESEARCH SYSTEM READY</span><span className="text-[9px] font-mono text-subtle truncate mt-0.5">Durable research worker</span></div>}</div>
          <Link href="/settings" onClick={onMobileClose} className={cn("flex items-center gap-2.5 p-1.5 rounded-md border border-transparent hover:border-border hover:bg-surface-2 transition-all", isCollapsed && "justify-center p-1")}><div className="w-7 h-7 rounded-full bg-surface-2 border border-border-strong text-accent flex items-center justify-center font-mono font-bold text-xs shrink-0 uppercase">{user ? getUserInitials(user) : "··"}</div>{!isCollapsed && user && <div className="flex flex-col min-w-0 flex-1"><span className="text-xs font-semibold text-foreground truncate leading-none">{user.name}</span><span className="text-[10px] text-subtle truncate mt-0.5 capitalize">{user.role}{user.organizationId ? " · Team" : " · Personal"}</span></div>}</Link>
        </div>
      </aside>
    </>
  );
}
