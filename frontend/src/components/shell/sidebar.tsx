"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { useVisibleNav, useActiveNav } from "@/lib/nav/use-nav";
import type { NavSection } from "@/lib/nav/manifest";
import { NavIcon } from "./icons";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "SB";
}

export function Sidebar({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const visible = useVisibleNav();
  const active = useActiveNav(visible);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const effectiveOpen = openKey ?? active.sectionKey;

  return (
    <nav className="flex h-full flex-col bg-paper-raised">
      <div className="flex-1 overflow-y-auto px-2 py-3">
        {visible.map((section) =>
          collapsed ? (
            <CollapsedItem key={section.key} section={section} active={active.sectionKey === section.key} onNavigate={onNavigate} />
          ) : (
            <NavGroup
              key={section.key}
              section={section}
              activeSectionKey={active.sectionKey}
              activeLeafHref={active.leafHref}
              open={effectiveOpen === section.key}
              onToggle={() => setOpenKey(effectiveOpen === section.key ? "" : section.key)}
              onNavigate={onNavigate}
            />
          ),
        )}
      </div>
      <AccountPlinth collapsed={collapsed} />
    </nav>
  );
}

function CollapsedItem({
  section,
  active,
  onNavigate,
}: {
  section: NavSection;
  active: boolean;
  onNavigate?: () => void;
}) {
  const href = section.href ?? section.children?.[0]?.href ?? "/overview";
  return (
    <Link
      href={href}
      onClick={onNavigate}
      title={section.label}
      className={`group relative mx-auto mb-1 flex h-10 w-10 items-center justify-center rounded-[7px] transition-colors ${
        active ? "bg-oxblood-tint text-oxblood" : "text-ink-muted hover:bg-paper hover:text-ink"
      }`}
    >
      {active ? (
        <span aria-hidden="true" className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-oxblood" />
      ) : null}
      <NavIcon name={section.icon} className="h-[18px] w-[18px]" />
    </Link>
  );
}

function NavGroup({
  section,
  activeSectionKey,
  activeLeafHref,
  open,
  onToggle,
  onNavigate,
}: {
  section: NavSection;
  activeSectionKey: string | null;
  activeLeafHref: string | null;
  open: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const isActiveSection = activeSectionKey === section.key;

  // Section that is itself a link (e.g. Overview).
  if (section.href && !section.children) {
    return (
      <Link
        href={section.href}
        onClick={onNavigate}
        className={`mb-0.5 flex items-center gap-2.5 rounded-[7px] px-2.5 py-2 text-[13.5px] transition-colors ${
          isActiveSection ? "bg-oxblood-tint font-medium text-oxblood" : "text-ink hover:bg-paper"
        }`}
      >
        <NavIcon name={section.icon} className="h-[17px] w-[17px] shrink-0" />
        {section.label}
      </Link>
    );
  }

  return (
    <div className="mb-0.5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`flex w-full items-center gap-2.5 rounded-[7px] px-2.5 py-2 text-left transition-colors ${
          isActiveSection ? "text-oxblood" : "text-ink hover:bg-paper"
        }`}
      >
        <NavIcon name={section.icon} className="h-[17px] w-[17px] shrink-0" />
        <span className="flex-1 text-[13.5px]">{section.label}</span>
        <svg
          viewBox="0 0 24 24"
          className={`h-3.5 w-3.5 text-ink-muted transition-transform duration-200 ${open ? "rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <ul className="mb-1 mt-0.5 ml-[19px] border-l border-rule pl-2.5">
          {section.children!.map((leaf) => {
            const isActive = activeLeafHref === leaf.href;
            const row = (
              <span className="flex items-center justify-between gap-2">
                <span>{leaf.label}</span>
                {leaf.soon ? (
                  <span className="rounded-[3px] border border-gold/50 px-1 py-px font-mono text-[8.5px] uppercase tracking-[0.1em] text-gold">
                    Soon
                  </span>
                ) : null}
              </span>
            );
            return (
              <li key={leaf.href}>
                {leaf.soon ? (
                  <span
                    aria-disabled="true"
                    title="Coming soon"
                    className="relative block cursor-not-allowed rounded-[6px] px-2.5 py-[7px] text-[13px] text-ink-muted/60"
                  >
                    {row}
                  </span>
                ) : (
                  <Link
                    href={leaf.href}
                    onClick={onNavigate}
                    className={`relative block rounded-[6px] px-2.5 py-[7px] text-[13px] transition-colors ${
                      isActive ? "bg-oxblood-tint font-medium text-oxblood" : "text-ink-muted hover:bg-paper hover:text-ink"
                    }`}
                  >
                    {isActive ? (
                      <span aria-hidden="true" className="absolute -left-[11px] top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r bg-oxblood" />
                    ) : null}
                    {row}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function AccountPlinth({ collapsed }: { collapsed: boolean }) {
  const { user } = useAuth();
  return (
    <div className="flex items-center gap-2.5 border-t border-rule px-3 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-rule-strong bg-paper font-mono text-[11px] font-medium text-oxblood">
        {initials(user.fullName)}
      </span>
      {!collapsed ? (
        <span className="min-w-0">
          <span className="block truncate text-[13px] text-ink">{user.fullName}</span>
          <span className="block truncate font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
            {user.role}
            {user.twoFactorEnabled ? " · 2FA ✓" : ""}
          </span>
        </span>
      ) : null}
    </div>
  );
}
