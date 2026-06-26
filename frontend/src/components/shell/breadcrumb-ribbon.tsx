"use client";

import { useVisibleNav, useActiveNav } from "@/lib/nav/use-nav";

export function BreadcrumbRibbon() {
  const visible = useVisibleNav();
  const { crumb } = useActiveNav(visible);
  // Safe to compute inline: this component only renders client-side (the shell
  // is gated behind AuthProvider's loader, never server-rendered).
  const date = new Date()
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();
  const stamp = `AS OF ${date} · IST`;

  return (
    <div className="z-30 flex h-9 shrink-0 items-center justify-between border-b border-rule bg-paper px-4">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
        <span className="text-ink-muted/70">Registry</span>
        {crumb.section ? (
          <>
            <span className="text-gold" aria-hidden="true">›</span>
            <span className={crumb.leaf ? "text-ink-muted" : "text-ink"}>{crumb.section}</span>
          </>
        ) : null}
        {crumb.leaf ? (
          <>
            <span className="text-gold" aria-hidden="true">›</span>
            <span className="text-ink">{crumb.leaf}</span>
          </>
        ) : null}
      </nav>
      <span className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted/70 sm:block">
        {stamp}
        <span className="sb-caret ml-0.5 inline-block text-oxblood">▍</span>
      </span>
    </div>
  );
}
