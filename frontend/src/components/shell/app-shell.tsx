"use client";

import { useCallback, useEffect, useState } from "react";
import { AuthProvider } from "@/lib/auth/auth-context";
import { CompanyProvider } from "@/lib/company/company-context";
import { useVisibleNav, flattenNav } from "@/lib/nav/use-nav";
import { Masthead } from "./masthead";
import { BreadcrumbRibbon } from "./breadcrumb-ribbon";
import { Sidebar } from "./sidebar";
import { CommandPalette } from "./command-palette";

const COLLAPSE_KEY = "sb.nav.collapsed";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <CompanyProvider>
        <ShellChrome>{children}</ShellChrome>
      </CompanyProvider>
    </AuthProvider>
  );
}

function ShellChrome({ children }: { children: React.ReactNode }) {
  const visible = useVisibleNav();
  const paletteItems = flattenNav(visible);

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const toggleCollapse = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // ⌘K / Ctrl-K → palette · ⌘\ / Ctrl-\ → collapse
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        toggleCollapse();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleCollapse]);

  return (
    <div className="flex h-screen flex-col bg-paper text-ink">
      <Masthead
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
        onToggleMobile={() => setMobileOpen(true)}
        onOpenPalette={() => setPaletteOpen(true)}
      />
      <BreadcrumbRibbon />

      <div className="flex min-h-0 flex-1">
        {/* Desktop sidebar */}
        <aside
          className="hidden shrink-0 border-r border-rule-strong shadow-[inset_-1px_0_0_rgba(255,255,255,0.6)] transition-[width] duration-200 motion-reduce:transition-none lg:block"
          style={{ width: collapsed ? 64 : 264 }}
        >
          <Sidebar collapsed={collapsed} />
        </aside>

        {/* Content */}
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <div className="absolute inset-y-0 left-0 w-[272px] border-r border-rule-strong bg-paper-raised shadow-[8px_0_30px_rgba(28,26,23,0.18)]">
            <Sidebar collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}

      {paletteOpen ? (
        <CommandPalette onClose={() => setPaletteOpen(false)} items={paletteItems} />
      ) : null}
    </div>
  );
}
