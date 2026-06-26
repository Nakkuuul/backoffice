"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Seal } from "@/components/auth/seal";
import { useAuth } from "@/lib/auth/auth-context";

function initials(name: string) {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "SB";
}

export function Masthead({
  collapsed,
  onToggleCollapse,
  onToggleMobile,
  onOpenPalette,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onToggleMobile: () => void;
  onOpenPalette: () => void;
}) {
  const { user } = useAuth();

  return (
    <header className="z-40 flex h-14 shrink-0 items-center gap-3 border-b border-rule-strong bg-paper-raised px-3 shadow-[inset_0_-1px_0_rgba(255,255,255,0.6)] sm:px-4">
      {/* Mobile drawer toggle */}
      <button
        type="button"
        onClick={onToggleMobile}
        aria-label="Open navigation"
        className="-ml-1 flex h-9 w-9 items-center justify-center rounded-[7px] text-ink-muted hover:bg-paper hover:text-ink lg:hidden"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
        </svg>
      </button>

      {/* Desktop collapse toggle */}
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="hidden h-9 w-9 items-center justify-center rounded-[7px] text-ink-muted hover:bg-paper hover:text-ink lg:flex"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
          <rect x="3.5" y="5" width="17" height="14" rx="1.6" />
          <path d="M9 5v14" />
        </svg>
      </button>

      {/* Brand */}
      <Link href="/overview" className="flex items-center gap-2.5">
        <Seal size={34} />
        <span className="hidden leading-none sm:block">
          <span
            className="block text-[15px] text-ink"
            style={{ fontFamily: "var(--font-display)", fontVariationSettings: "'opsz' 40, 'wght' 520" }}
          >
            Sapphire Broking
          </span>
          <span className="mt-0.5 block font-mono text-[9.5px] uppercase tracking-[0.22em] text-oxblood">
            Backoffice
          </span>
        </span>
      </Link>

      <span aria-hidden="true" className="mx-1 hidden h-7 w-px bg-rule sm:block" />

      {/* Search → command palette */}
      <button
        type="button"
        onClick={onOpenPalette}
        className="ml-auto hidden h-9 w-full max-w-[320px] items-center gap-2 rounded-[7px] border border-rule-strong bg-field px-3 text-left text-ink-muted transition-colors hover:border-oxblood/50 md:ml-2 md:flex"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m20 20-3.2-3.2" strokeLinecap="round" />
        </svg>
        <span className="flex-1 font-mono text-[12px] tracking-[0.02em]">Search the registry…</span>
        <kbd className="rounded-[4px] border border-gold/60 px-1.5 py-px font-mono text-[10px] text-gold">⌘K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-2 md:ml-3">
        {/* Mobile search icon */}
        <button
          type="button"
          onClick={onOpenPalette}
          aria-label="Search"
          className="flex h-9 w-9 items-center justify-center rounded-[7px] text-ink-muted hover:bg-paper hover:text-ink md:hidden"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m20 20-3.2-3.2" strokeLinecap="round" />
          </svg>
        </button>

        <span className="hidden items-center gap-1.5 rounded-[5px] border border-forest/30 bg-forest-tint px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-forest sm:flex">
          On-Prem
        </span>

        <span
          title={user.twoFactorEnabled ? "Two-factor enabled" : "Two-factor not enrolled"}
          className={`hidden h-2 w-2 rounded-full sm:block ${user.twoFactorEnabled ? "bg-forest" : "bg-gold"}`}
          aria-hidden="true"
        />

        <AccountMenu />
      </div>
    </header>
  );
}

function AccountMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-rule-strong bg-paper font-mono text-[12px] font-medium text-oxblood transition-colors hover:border-oxblood"
      >
        {initials(user.fullName)}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-11 w-60 overflow-hidden rounded-[9px] border border-rule-strong bg-paper-raised shadow-[0_16px_40px_rgba(28,26,23,0.18)]"
        >
          <div className="border-b border-rule px-4 py-3">
            <p className="truncate text-[14px] text-ink">{user.fullName}</p>
            <p className="truncate text-[12px] text-ink-muted">{user.email}</p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-oxblood">
              {user.role}
              {user.clientRef ? ` · ${user.clientRef}` : ""}
            </p>
          </div>
          <div className="py-1">
            <Link
              href="/me/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-[13px] text-ink hover:bg-paper"
            >
              Profile
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={logout}
              className="block w-full px-4 py-2 text-left text-[13px] text-danger hover:bg-oxblood-tint"
            >
              Sign out
            </button>
          </div>
          <p className="border-t border-rule px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
            v2026.06
          </p>
        </div>
      ) : null}
    </div>
  );
}
